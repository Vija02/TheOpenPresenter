import { randomUUID } from "crypto";
import { Pool } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import * as Y from "yjs";

import {
  TEST_DATABASE_URL,
  deleteTestUsers,
  poolFromUrl,
} from "../../__tests__/helpers";
import { introspectCloudSyncTables } from "../../backend-shared/src/cloud/sync/pluginTables/introspection";
import type { CloudProject } from "../../backend-shared/src/cloud/sync/projects/cloud";
import { syncProjects } from "../../backend-shared/src/cloud/sync/projects/sync";
import {
  ProjectSyncValue,
  projectSyncValueSql,
} from "../../backend-shared/src/cloud/sync/projects/value";
import { WithPgClient } from "../../backend-shared/src/types";
import { FakeCloud, resetFakeCloud, startFakeCloud } from "./helpers/fakeCloud";

/**
 * The local half of project sync, against a real database and a fake cloud,
 * one describe per row of the decision table in sync.ts. The cloud's own SQL
 * is tested in cloudProjectServe.test.ts.
 */

const ORG_PREFIX = "testprojectsync";

const value = (
  name: string,
  extra: Partial<ProjectSyncValue> = {},
): ProjectSyncValue => ({
  name,
  targetDate: null,
  category: null,
  tags: [],
  ...extra,
});

let pool: Pool;
let fake: FakeCloud;
let orgId: string;
let userId: string;
let connection: {
  id: string;
  host: string;
  session_cookie: string;
  organization_id: string;
  target_organization_slug: string;
  creator_user_id: string | null;
};
/** A fresh id per test: the fake's Hocuspocus keeps documents by name. */
let cloudId: string;

const withPgClient: WithPgClient = async (callback) => {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
};

const sync = (forceResync = false) =>
  syncProjects(withPgClient, connection, { forceResync });

const query = async (text: string, params: unknown[] = []) =>
  (await pool.query(text, params)).rows;

/** Sync, and expect nothing to move in either direction. */
const expectQuietSync = async () => {
  const pushesBefore = fake.projectPushes.length;
  const fetchesBefore = fake.documentsFetched.length;
  const localBefore = await localProjects();
  const result = await sync();
  expect(result).toMatchObject({
    pulled: 0,
    pushed: 0,
    pushRejected: 0,
    deletedLocally: 0,
    skipped: 0,
    documentsSynced: 0,
  });
  expect(fake.projectPushes.length).toBe(pushesBefore);
  expect(fake.documentsFetched.length).toBe(fetchesBefore);
  expect(await localProjects()).toEqual(localBefore);
};

const onCloud = (id: string, projectValue: ProjectSyncValue): CloudProject => {
  const project = {
    id,
    createdAt: "2026-02-01T10:00:00.000Z",
    updatedAt: fake.now(),
    value: projectValue,
  };
  fake.projects.push(project);
  return project;
};

/** Edit a cloud project's metadata, as a person on the cloud would. */
const editOnCloud = (id: string, change: Partial<ProjectSyncValue>) => {
  const project = fake.projects.find((p) => p.id === id)!;
  project.value = { ...project.value, ...change };
  project.updatedAt = fake.now();
};

/** A document save on the cloud: metadata unchanged, `updated_at` moved. */
const saveDocumentOnCloud = (id: string, text?: string) => {
  if (text !== undefined) {
    fake.documents.set(id, withText(fake.documents.get(id) ?? null, text));
  }
  fake.projects.find((p) => p.id === id)!.updatedAt = fake.now();
};

const createLocal = async (
  name: string,
  {
    tags = [],
    category = null,
  }: { tags?: string[]; category?: string | null } = {},
) => {
  const [{ id }] = await query(
    `insert into app_public.projects (organization_id, slug, name, category_id)
     values ($1, $2, $3, (select id from app_public.categories
                          where organization_id = $1 and name = $4))
     returning id`,
    [orgId, `slug-${randomUUID()}`, name, category],
  );
  await setLocalTags(id, tags);
  return id as string;
};

const editLocal = (id: string, set: string, params: unknown[] = []) =>
  query(`update app_public.projects set ${set} where id = $1`, [id, ...params]);

const setLocalTags = async (projectId: string, tags: string[]) => {
  await query("delete from app_public.project_tags where project_id = $1", [
    projectId,
  ]);
  await query(
    `insert into app_public.project_tags (project_id, tag_id)
     select $1, id from app_public.tags
     where organization_id = $2 and name = any($3::text[])`,
    [projectId, orgId, tags],
  );
};

const localProjects = () =>
  query(
    `select p.id, p.cloud_project_id, p.cloud_connection_id,
       ${projectSyncValueSql("p")} as value
     from app_public.projects p where p.organization_id = $1
     order by p.name`,
    [orgId],
  );

const localByCloudId = async (id: string) =>
  (await localProjects()).find((p) => p.cloud_project_id === id);

/** A Yjs document with `text` added to the `lines` array. */
const withText = (state: Uint8Array | null, text: string) => {
  const doc = new Y.Doc();
  if (state) Y.applyUpdate(doc, state);
  doc.getArray<string>("lines").push([text]);
  return Y.encodeStateAsUpdate(doc);
};
const linesOf = (state: Uint8Array | Buffer | null) => {
  const doc = new Y.Doc();
  if (state) Y.applyUpdate(doc, new Uint8Array(state));
  return [...doc.getArray<string>("lines").toArray()].sort();
};
const localDocument = async (projectId: string) => {
  const [{ document }] = await query(
    "select document from app_public.projects where id = $1",
    [projectId],
  );
  return document as Buffer | null;
};

beforeAll(async () => {
  pool = poolFromUrl(TEST_DATABASE_URL);
  const { tables } = await introspectCloudSyncTables(pool);
  fake = await startFakeCloud(tables);
});

afterAll(async () => {
  await fake.close();
});

beforeEach(async () => {
  resetFakeCloud(fake);
  cloudId = randomUUID();

  // Sync commits its own transactions, so tests write real rows and clean up
  // by org instead of rolling back.
  [{ id: orgId }] = await query(
    `insert into app_public.organizations (slug, name)
     values ($1, 'Project sync') returning id`,
    [`${ORG_PREFIX}-${Date.now()}`],
  );
  await query(`delete from app_public.categories where organization_id = $1`, [
    orgId,
  ]);
  await query(
    `insert into app_public.categories (organization_id, name)
     values ($1, 'Sunday'), ($1, 'Youth')`,
    [orgId],
  );
  await query(
    `insert into app_public.tags (organization_id, name)
     values ($1, 'band'), ($1, 'choir'), ($1, 'Acoustic')`,
    [orgId],
  );
  [{ id: userId }] = await query(
    `select id from app_private.really_create_user(
       username := 'testuser_projectsync', email := 'testuser_projectsync@example.com',
       email_is_verified := true, name := 'Project Sync', avatar_url := null,
       password := 'TestUserPassword')`,
  );
  [connection] = await query(
    `insert into app_public.cloud_connections
       (organization_id, host, session_cookie, session_cookie_expiry,
        target_organization_slug, creator_user_id)
     values ($1, $2, 'session=test', now() + interval '1 day', 'cloudorg', $3)
     returning id, host, session_cookie, organization_id,
       target_organization_slug, creator_user_id`,
    [orgId, fake.url, userId],
  );
});

afterEach(async () => {
  // Cascades to projects, the connection and its sync state.
  await query(`delete from app_public.organizations where slug like $1`, [
    `${ORG_PREFIX}-%`,
  ]);
  await deleteTestUsers();
});

describe("a project only on the cloud", () => {
  it("is pulled under a local id, with its category, tags and date", async () => {
    const cloud = onCloud(
      cloudId,
      value("Easter", {
        targetDate: "2027-03-28T09:30:00.123456Z",
        category: "Sunday",
        tags: ["band", "choir"],
      }),
    );

    expect(await sync()).toMatchObject({ pulled: 1, added: 1, pushed: 0 });

    const [project] = await query(
      `select p.*, ${projectSyncValueSql("p")} as value
       from app_public.projects p where p.organization_id = $1`,
      [orgId],
    );
    expect(project.id).not.toBe(cloudId);
    expect(project).toMatchObject({
      cloud_project_id: cloudId,
      cloud_connection_id: connection.id,
      creator_user_id: userId,
      value: cloud.value,
    });
    expect(project.created_at.toISOString()).toBe(cloud.createdAt);
    expect(project.cloud_last_updated.toISOString()).toBe(cloud.updatedAt);
    expect(fake.documentsFetched).toEqual([cloudId]);
    await expectQuietSync();
  });

  it("is skipped, and retried, if it names a tag missing here", async () => {
    onCloud(cloudId, value("Easter", { tags: ["drums"] }));

    expect(await sync()).toMatchObject({ skipped: 1, pulled: 0 });
    expect(await localProjects()).toEqual([]);

    await query(
      `insert into app_public.tags (organization_id, name) values ($1, 'drums')`,
      [orgId],
    );
    expect(await sync()).toMatchObject({ skipped: 0, pulled: 1 });
  });

  it("is skipped if it names a category missing here", async () => {
    onCloud(cloudId, value("Easter", { category: "Weddings" }));

    expect(await sync()).toMatchObject({ skipped: 1, pulled: 0 });
    expect(await localProjects()).toEqual([]);
  });
});

describe("a project only here", () => {
  it("is created on the cloud under its own id, then connected", async () => {
    const localId = await createLocal("Christmas", {
      tags: ["choir", "band"],
      category: "Youth",
    });
    await editLocal(localId, "target_date = '2027-12-25 18:00:00.5+11'");

    expect(await sync()).toMatchObject({ pushed: 1, pulled: 0 });

    expect(fake.projects).toEqual([
      expect.objectContaining({
        id: localId,
        value: value("Christmas", {
          targetDate: "2027-12-25T07:00:00.500000Z",
          category: "Youth",
          tags: ["band", "choir"],
        }),
      }),
    ]);
    expect(await localProjects()).toEqual([
      expect.objectContaining({
        id: localId,
        cloud_project_id: localId,
        cloud_connection_id: connection.id,
      }),
    ]);
    expect(fake.documentsFetched).toEqual([localId]);
    // The value the cloud stored is exactly the one computed here.
    await expectQuietSync();
  });

  it("sorts tags the same way whatever the locale", async () => {
    await createLocal("Mixed", { tags: ["band", "Acoustic", "choir"] });

    await sync();

    expect(fake.projects[0]!.value.tags).toEqual(["Acoustic", "band", "choir"]);
    await expectQuietSync();
  });

  it("is pushed in batches when there are many", async () => {
    for (let i = 0; i < 101; i++) await createLocal(`Project ${i}`);

    expect(await sync()).toMatchObject({ pushed: 101 });

    expect(
      fake.requests.filter((r) => r === "cloudProjectSyncPush"),
    ).toHaveLength(2);
    expect(fake.projects).toHaveLength(101);
    await expectQuietSync();
  });

  it("is pushed in parts when over the cloud's request limit", async () => {
    // 50 projects with 3kb names: about 150kb in one request.
    for (let i = 0; i < 50; i++) {
      await createLocal(`${i} ${"long name ".repeat(300)}`);
    }

    expect(await sync()).toMatchObject({ pushed: 50, pushRejected: 0 });
    expect(fake.projects).toHaveLength(50);
  });

  it("stays unconnected until a rejected create lands", async () => {
    const localId = await createLocal("Christmas");
    fake.rejectProjectPushes = true;

    expect(await sync()).toMatchObject({ pushed: 0, pushRejected: 1 });
    // The bridge goes by the connection, so it leaves this project alone.
    expect((await localProjects())[0]).toMatchObject({
      cloud_project_id: localId,
      cloud_connection_id: null,
    });

    fake.rejectProjectPushes = false;
    expect(await sync()).toMatchObject({ pushed: 1, pushRejected: 0 });
    expect(fake.projects.map((p) => p.id)).toEqual([localId]);
    expect((await localProjects())[0].cloud_connection_id).toBe(connection.id);
  });

  it("is not created twice when the push response is lost", async () => {
    const localId = await createLocal("Christmas");
    fake.loseProjectResponses = true;

    await expect(sync()).rejects.toThrow();
    expect(fake.projects.map((p) => p.id)).toEqual([localId]);

    fake.loseProjectResponses = false;
    await sync();

    expect(fake.projects.map((p) => p.id)).toEqual([localId]);
    expect(await localProjects()).toEqual([
      expect.objectContaining({
        id: localId,
        cloud_project_id: localId,
        cloud_connection_id: connection.id,
      }),
    ]);
    await expectQuietSync();
  });

  it("keeps an edit made here after a create whose response was lost", async () => {
    const localId = await createLocal("Christmas");
    fake.loseProjectResponses = true;
    await expect(sync()).rejects.toThrow();

    fake.loseProjectResponses = false;
    await editLocal(localId, "name = 'Christmas Eve'");
    expect(await sync()).toMatchObject({ pushed: 1, pulled: 0 });

    expect(fake.projects).toEqual([
      expect.objectContaining({ id: localId, value: value("Christmas Eve") }),
    ]);
    expect((await localProjects())[0].value.name).toBe("Christmas Eve");
    await expectQuietSync();
  });

  it("is not pushed if temporary, nor deleted", async () => {
    await query(
      `insert into app_public.projects (organization_id, slug, name, is_temporary)
       values ($1, 'guest', 'Guest', true)`,
      [orgId],
    );

    expect(await sync()).toMatchObject({ total: 0 });
    expect(fake.projectPushes).toEqual([]);
    expect(await localProjects()).toHaveLength(1);
  });

  it("is not pushed if it belongs to another organization", async () => {
    const [{ id: otherOrg }] = await query(
      `insert into app_public.organizations (slug, name)
       values ($1, 'Other') returning id`,
      [`${ORG_PREFIX}-other-${Date.now()}`],
    );
    await query(
      `insert into app_public.projects (organization_id, slug, name)
       values ($1, 'elsewhere', 'Elsewhere')`,
      [otherOrg],
    );

    expect(await sync()).toMatchObject({ total: 0 });
    expect(fake.projectPushes).toEqual([]);
  });
});

describe("a project on both sides", () => {
  let localId: string;
  const synced = value("Easter", { category: "Sunday", tags: ["band"] });

  beforeEach(async () => {
    onCloud(cloudId, synced);
    await sync();
    localId = (await localByCloudId(cloudId))!.id;
    fake.documentsFetched = [];
  });

  it("does nothing when neither side changed", async () => {
    await expectQuietSync();
  });

  it("pushes metadata edited here, based on what was last synced", async () => {
    await editLocal(
      localId,
      `name = 'Easter Sunday', target_date = '2027-03-28T09:30:00Z',
       category_id = (select id from app_public.categories
                      where organization_id = $2 and name = 'Youth')`,
      [orgId],
    );
    await setLocalTags(localId, ["choir", "Acoustic"]);

    expect(await sync()).toMatchObject({ pushed: 1, pulled: 0 });

    const edited = value("Easter Sunday", {
      targetDate: "2027-03-28T09:30:00.000000Z",
      category: "Youth",
      tags: ["Acoustic", "choir"],
    });
    expect(fake.projectPushes).toEqual([
      {
        id: cloudId,
        expected: { value: synced, updatedAt: expect.any(String) },
        value: edited,
      },
    ]);
    expect(fake.projects[0]!.value).toEqual(edited);
    await expectQuietSync();
  });

  it("pushes a cleared category and tags", async () => {
    await editLocal(localId, "category_id = null");
    await setLocalTags(localId, []);

    await sync();

    expect(fake.projects[0]!.value).toEqual(value("Easter"));
  });

  it("pulls metadata edited on the cloud, including clearing it", async () => {
    editOnCloud(cloudId, { name: "Easter Sunday", category: null, tags: [] });

    expect(await sync()).toMatchObject({ pulled: 1, added: 0, pushed: 0 });

    expect((await localByCloudId(cloudId))!.value).toEqual(
      value("Easter Sunday"),
    );
    await expectQuietSync();
  });

  it("keeps both sides' edits to different fields", async () => {
    await editLocal(localId, "name = 'Easter Sunday'");
    editOnCloud(cloudId, { category: "Youth" });

    expect(await sync()).toMatchObject({ merged: 1, pushed: 1, pulled: 0 });

    const both = value("Easter Sunday", { category: "Youth", tags: ["band"] });
    expect(fake.projects[0]!.value).toEqual(both);
    expect((await localByCloudId(cloudId))!.value).toEqual(both);
    await expectQuietSync();
  });

  it("merges tags added and removed on either side", async () => {
    // Synced: ["band"]. Here: band removed, choir added. Cloud: Acoustic added.
    await setLocalTags(localId, ["choir"]);
    editOnCloud(cloudId, { tags: ["band", "Acoustic"] });

    await sync();

    const merged = value("Easter", {
      category: "Sunday",
      tags: ["Acoustic", "choir"],
    });
    expect(fake.projects[0]!.value).toEqual(merged);
    expect((await localByCloudId(cloudId))!.value).toEqual(merged);
    await expectQuietSync();
  });

  it("orders merged tags as the database does, capitals first", async () => {
    await query(
      `insert into app_public.tags (organization_id, name)
       values ($1, 'Zebra'), ($1, 'alpha')`,
      [orgId],
    );
    await setLocalTags(localId, ["band", "alpha"]);
    editOnCloud(cloudId, { tags: ["Zebra", "band"] });

    await sync();

    expect(fake.projects[0]!.value.tags).toEqual(["Zebra", "alpha", "band"]);
    await expectQuietSync();
  });

  it("only pulls when the cloud's edit covers everything", async () => {
    await editLocal(localId, "name = 'Local'");
    editOnCloud(cloudId, { name: "Cloud", tags: [] });

    expect(await sync()).toMatchObject({ merged: 1, pulled: 1, pushed: 0 });
    expect(fake.projectPushes).toEqual([]);
  });

  it("only pushes when the merge equals what is here", async () => {
    // Both removed the tag; only here was the name changed.
    await editLocal(localId, "name = 'Local'");
    await setLocalTags(localId, []);
    editOnCloud(cloudId, { tags: [] });

    expect(await sync()).toMatchObject({ merged: 1, pushed: 1, pulled: 0 });
    expect(fake.projects[0]!.value).toEqual(
      value("Local", { category: "Sunday" }),
    );
    await expectQuietSync();
  });

  it("merges again if the cloud changed while the merge was on its way", async () => {
    await editLocal(localId, "name = 'Local'");
    editOnCloud(cloudId, { category: "Youth" });
    fake.beforeProjectPush = () => editOnCloud(cloudId, { tags: [] });

    expect(await sync()).toMatchObject({ merged: 1, pushRejected: 1 });

    fake.beforeProjectPush = null;
    await sync();
    const all = value("Local", { category: "Youth" });
    expect(fake.projects[0]!.value).toEqual(all);
    expect((await localByCloudId(cloudId))!.value).toEqual(all);
  });

  it("does not overwrite an edit made here while the merge was on its way", async () => {
    await editLocal(localId, "name = 'Local'");
    editOnCloud(cloudId, { category: "Youth" });
    fake.beforeProjectPush = () =>
      editLocal(localId, "target_date = '2027-01-01T00:00:00Z'");

    expect(await sync()).toMatchObject({ merged: 1, pushed: 1, skipped: 1 });

    fake.beforeProjectPush = null;
    await sync();
    const all = value("Local", {
      category: "Youth",
      tags: ["band"],
      targetDate: "2027-01-01T00:00:00.000000Z",
    });
    expect((await localByCloudId(cloudId))!.value).toEqual(all);
    expect(fake.projects[0]!.value).toEqual(all);
    await expectQuietSync();
  });

  it("lets the cloud win when both sides edited the same field", async () => {
    await editLocal(localId, "name = 'Local'");
    editOnCloud(cloudId, { name: "Cloud" });

    expect(await sync()).toMatchObject({ pulled: 1, pushed: 0 });

    expect((await localByCloudId(cloudId))!.value.name).toBe("Cloud");
    expect(fake.projectPushes).toEqual([]);
    await expectQuietSync();
  });

  it("settles without moving anything when both made the same edit", async () => {
    await editLocal(localId, "name = 'Same'");
    editOnCloud(cloudId, { name: "Same" });

    expect(await sync()).toMatchObject({ pulled: 0, pushed: 0 });
    await expectQuietSync();
  });

  it("does not overwrite a cloud edit made while the push was on its way", async () => {
    await editLocal(localId, "name = 'Local'");
    fake.beforeProjectPush = () => editOnCloud(cloudId, { name: "Cloud" });

    expect(await sync()).toMatchObject({ pushed: 0, pushRejected: 1 });
    expect(fake.projects[0]!.value.name).toBe("Cloud");

    fake.beforeProjectPush = null;
    // Now both sides changed the name: the cloud wins.
    expect(await sync()).toMatchObject({ pulled: 1, pushed: 0 });
    expect((await localByCloudId(cloudId))!.value.name).toBe("Cloud");
  });

  it("retries a rejected push from the same base", async () => {
    await editLocal(localId, "name = 'Local'");
    fake.rejectProjectPushes = true;
    expect(await sync()).toMatchObject({ pushRejected: 1 });

    fake.rejectProjectPushes = false;
    expect(await sync()).toMatchObject({ pushed: 1 });
    expect(fake.projectPushes[1]!.expected!.value).toEqual(synced);
    expect(fake.projects[0]!.value.name).toBe("Local");
  });

  it("leaves the project alone when a pull names a tag missing here", async () => {
    editOnCloud(cloudId, { name: "Renamed", tags: ["drums"] });

    expect(await sync()).toMatchObject({ skipped: 1, pulled: 0 });

    expect((await localByCloudId(cloudId))!.value).toEqual(synced);
  });
});

describe("a project deleted on the cloud", () => {
  let localId: string;

  beforeEach(async () => {
    onCloud(cloudId, value("Easter"));
    await sync();
    localId = (await localByCloudId(cloudId))!.id;
    fake.projects = [];
  });

  it("is deleted here if untouched since", async () => {
    expect(await sync()).toMatchObject({ deletedLocally: 1, pushed: 0 });

    expect(await localProjects()).toEqual([]);
    // Nothing left to remember, so it does not come back.
    expect(await sync()).toMatchObject({ total: 0 });
  });

  it("is created again if its metadata was edited here", async () => {
    await editLocal(localId, "name = 'Kept'");

    expect(await sync()).toMatchObject({ deletedLocally: 0, pushed: 1 });

    expect(fake.projects).toEqual([
      expect.objectContaining({ id: cloudId, value: value("Kept") }),
    ]);
    await expectQuietSync();
  });

  it("is created again if its category was renamed here", async () => {
    await editLocal(
      localId,
      `category_id = (select id from app_public.categories
                      where organization_id = $2 and name = 'Sunday')`,
      [orgId],
    );
    // Seen as synced, then the category renamed: the project's `updated_at`
    // does not move, its value does.
    fake.projects = [];
    onCloud(cloudId, value("Easter", { category: "Sunday" }));
    await sync();
    fake.projects = [];
    await query(
      `update app_public.categories set name = 'Sunday AM'
       where organization_id = $1 and name = 'Sunday'`,
      [orgId],
    );

    expect(await sync()).toMatchObject({ deletedLocally: 0, pushed: 1 });
    expect(fake.projects[0]!.value.category).toBe("Sunday AM");
  });

  it("is created again if only its document was edited here", async () => {
    await editLocal(localId, "document = $2", [
      Buffer.from(withText(null, "local")),
    ]);

    expect(await sync()).toMatchObject({ deletedLocally: 0, pushed: 1 });

    expect(fake.projects.map((p) => p.id)).toEqual([cloudId]);
    // And the document goes with it.
    expect(linesOf(fake.documents.get(cloudId) ?? null)).toEqual(["local"]);
  });
});

describe("a project deleted here", () => {
  beforeEach(async () => {
    onCloud(cloudId, value("Easter"));
    await sync();
    await query(`delete from app_public.projects where organization_id = $1`, [
      orgId,
    ]);
  });

  it("is deleted on the cloud if untouched there", async () => {
    expect(await sync()).toMatchObject({ pushed: 1, pulled: 0 });

    expect(fake.projects).toEqual([]);
    expect(await sync()).toMatchObject({ total: 0 });
  });

  it("is pulled back if its metadata was edited on the cloud", async () => {
    editOnCloud(cloudId, { name: "Kept" });

    expect(await sync()).toMatchObject({ pushed: 0, pulled: 1, added: 1 });

    expect((await localByCloudId(cloudId))!.value.name).toBe("Kept");
  });

  it("is pulled back if its category was renamed on the cloud", async () => {
    // A rename on the cloud changes the value, not the project's `updated_at`.
    await query(
      `insert into app_public.categories (organization_id, name)
       values ($1, 'Renamed')`,
      [orgId],
    );
    fake.projects[0]!.value = {
      ...fake.projects[0]!.value,
      category: "Renamed",
    };

    expect(await sync()).toMatchObject({ pushed: 0, pulled: 1, added: 1 });
  });

  it("is pulled back if its document was edited on the cloud", async () => {
    saveDocumentOnCloud(cloudId, "cloud");

    expect(await sync()).toMatchObject({ pushed: 0, pulled: 1, added: 1 });

    const project = (await localByCloudId(cloudId))!;
    expect(linesOf(await localDocument(project.id))).toEqual(["cloud"]);
  });

  it("is pulled back if edited on the cloud while the delete was on its way", async () => {
    fake.beforeProjectPush = () => saveDocumentOnCloud(cloudId);

    expect(await sync()).toMatchObject({ pushed: 0, pushRejected: 1 });
    expect(fake.projects).toHaveLength(1);

    fake.beforeProjectPush = null;
    expect(await sync()).toMatchObject({ pulled: 1, added: 1 });
  });

  it("is forgotten if the cloud deleted it too", async () => {
    fake.projects = [];

    expect(await sync()).toMatchObject({ total: 1, pushed: 0, pulled: 0 });
    expect(fake.projectPushes).toEqual([]);
    expect(await sync()).toMatchObject({ total: 0 });
  });
});

describe("documents", () => {
  it("pulls the cloud's document into a project without one", async () => {
    onCloud(cloudId, value("Easter"));
    fake.documents.set(cloudId, withText(null, "cloud"));

    await sync();

    const project = (await localByCloudId(cloudId))!;
    expect(linesOf(await localDocument(project.id))).toEqual(["cloud"]);
  });

  it("merges edits made on both sides while apart", async () => {
    onCloud(cloudId, value("Easter"));
    fake.documents.set(cloudId, withText(null, "base"));
    await sync();
    const project = (await localByCloudId(cloudId))!;

    // Offline here, and at the same time on the cloud.
    await editLocal(project.id, "document = $2", [
      Buffer.from(withText(await localDocument(project.id), "local")),
    ]);
    saveDocumentOnCloud(cloudId, "cloud");

    await sync();

    expect(linesOf(await localDocument(project.id))).toEqual([
      "base",
      "cloud",
      "local",
    ]);
    expect(linesOf(fake.documents.get(cloudId)!)).toEqual([
      "base",
      "cloud",
      "local",
    ]);
    // The push moved the cloud's `updated_at`, so one more merge, which
    // finds nothing; then it settles.
    await sync();
    await expectQuietSync();
  });

  it("pushes the document of a project created here", async () => {
    const localId = await createLocal("Christmas");
    await editLocal(localId, "document = $2", [
      Buffer.from(withText(null, "offline")),
    ]);

    await sync();

    expect(linesOf(fake.documents.get(localId)!)).toEqual(["offline"]);
  });

  it("merges only when either side's updated_at moved, or when forced", async () => {
    onCloud(cloudId, value("Easter"));
    await sync();
    const project = (await localByCloudId(cloudId))!;
    fake.documentsFetched = [];

    await editLocal(project.id, "document = $2", [
      Buffer.from(withText(null, "local")),
    ]);
    await sync();
    expect(fake.documentsFetched).toEqual([cloudId]);

    // Two merges: the push above moved the cloud's `updated_at`.
    await sync();
    fake.documentsFetched = [];
    await sync();
    expect(fake.documentsFetched).toEqual([]);

    saveDocumentOnCloud(cloudId);
    await sync();
    expect(fake.documentsFetched).toEqual([cloudId]);

    fake.documentsFetched = [];
    await sync(true);
    expect(fake.documentsFetched).toEqual([cloudId]);
  });

  it("retries a failed merge next sync, without pulling the metadata again", async () => {
    onCloud(cloudId, value("Easter"));
    fake.failDocuments.add(cloudId);

    expect(await sync()).toMatchObject({ pulled: 1, documentsFailed: 1 });

    fake.failDocuments.clear();
    fake.documents.set(cloudId, withText(null, "cloud"));
    expect(await sync()).toMatchObject({
      pulled: 0,
      pushed: 0,
      documentsSynced: 1,
    });
    const project = (await localByCloudId(cloudId))!;
    expect(linesOf(await localDocument(project.id))).toEqual(["cloud"]);
    await expectQuietSync();
  });
});

describe("when the cloud cannot answer", () => {
  beforeEach(async () => {
    onCloud(cloudId, value("Easter"));
    await sync();
    await createLocal("Local only");
  });

  it("changes nothing if the organization is not found", async () => {
    const before = await localProjects();
    fake.orgMissing = true;

    await expect(sync()).rejects.toThrow("Organization not found");

    expect(await localProjects()).toEqual(before);
  });

  it("changes nothing if the cloud predates project sync", async () => {
    const before = await localProjects();
    fake.unsupported = true;

    await expect(sync()).rejects.toThrow();

    expect(await localProjects()).toEqual(before);
    expect(fake.projectPushes).toEqual([]);
  });
});

describe("after reconnecting", () => {
  it("matches projects up again instead of duplicating them", async () => {
    onCloud(cloudId, value("Easter"));
    const localId = await createLocal("Christmas");
    await sync();

    // A new connection starts without state.
    await query("delete from app_public.cloud_connections where id = $1", [
      connection.id,
    ]);
    [connection] = await query(
      `insert into app_public.cloud_connections
         (organization_id, host, session_cookie, session_cookie_expiry,
          target_organization_slug, creator_user_id)
       values ($1, $2, 'session=test', now() + interval '1 day', 'cloudorg', $3)
       returning id, host, session_cookie, organization_id,
         target_organization_slug, creator_user_id`,
      [orgId, fake.url, userId],
    );

    expect(await sync()).toMatchObject({ pulled: 0, pushed: 0, added: 0 });

    expect(fake.projects.map((p) => p.id).sort()).toEqual(
      [cloudId, localId].sort(),
    );
    const projects = await localProjects();
    expect(projects).toHaveLength(2);
    expect(projects.every((p) => p.cloud_connection_id === connection.id)).toBe(
      true,
    );
    await expectQuietSync();
  });
});

describe("projects pulled before sync kept state", () => {
  /** As the old pull left them: `updated_at` set to the cloud's. */
  const pulledByOldSync = async (name = "Old") =>
    withPgClient(async (client) => {
      await client.query("begin");
      await client.query("set local session_replication_role = replica");
      const {
        rows: [row],
      } = await client.query(
        `insert into app_public.projects
           (organization_id, slug, name, cloud_connection_id,
            cloud_project_id, updated_at, cloud_last_updated)
         values ($1, 'old', $4, $2, $3, '2026-05-01', '2026-05-01')
         returning id`,
        [orgId, connection.id, cloudId, name],
      );
      await client.query("commit");
      return row.id as string;
    });

  it("are adopted when the cloud still has them", async () => {
    await pulledByOldSync();
    onCloud(cloudId, value("Old"));

    expect(await sync()).toMatchObject({ pushed: 0, pulled: 0 });
    await expectQuietSync();
  });

  it("take the cloud's metadata if it differs", async () => {
    await pulledByOldSync("Stale");
    onCloud(cloudId, value("Fresh"));

    expect(await sync()).toMatchObject({ pushed: 0, pulled: 1, added: 0 });
    const projects = await localProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].value.name).toBe("Fresh");
  });

  it("are deleted when the cloud deleted them, if untouched here", async () => {
    await pulledByOldSync();

    expect(await sync()).toMatchObject({ deletedLocally: 1, pushed: 0 });
    expect(await localProjects()).toEqual([]);
  });

  it("are pushed back when the cloud deleted them, if edited here", async () => {
    const id = await pulledByOldSync();
    await editLocal(id, "name = 'Edited'");

    expect(await sync()).toMatchObject({ deletedLocally: 0, pushed: 1 });
    expect(fake.projects).toEqual([
      expect.objectContaining({ id: cloudId, value: value("Edited") }),
    ]);
  });
});
