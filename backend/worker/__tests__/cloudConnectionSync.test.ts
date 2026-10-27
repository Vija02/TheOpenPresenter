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
  vi,
} from "vitest";

import {
  TEST_DATABASE_URL,
  deleteTestUsers,
  poolFromUrl,
} from "../../__tests__/helpers";
import { introspectCloudSyncTables } from "../../backend-shared/src/cloud/sync/pluginTables/introspection";
import { projectSyncValueSql } from "../../backend-shared/src/cloud/sync/projects/value";
import {
  CLOUD_ORG_ID,
  FakeCloud,
  resetFakeCloud,
  startFakeCloud,
} from "./helpers/fakeCloud";

// Media go to a file store in a temporary directory, read when it loads.
const { uploads, previousEnv } = vi.hoisted(() => {
  const dir = require("fs").mkdtempSync(
    require("path").join(require("os").tmpdir(), "connection-sync-"),
  );
  const previousEnv = {
    STORAGE_TYPE: process.env.STORAGE_TYPE,
    UPLOADS_PATH: process.env.UPLOADS_PATH,
  };
  process.env.STORAGE_TYPE = "file";
  process.env.UPLOADS_PATH = dir;
  return { uploads: dir, previousEnv };
});

// The task imports the package, whose `dist` may be stale; test the source.
vi.mock(
  "@repo/backend-shared",
  async () => await import("../../backend-shared/src"),
);

/**
 * The whole `cloud_connection__sync` task, as the worker runs it: tables,
 * then projects and documents, the sync run's record, and the media job.
 */

const ORG_PREFIX = "testconnectionsync";

let pool: Pool;
let fake: FakeCloud;
let orgId: string;
let connectionId: string;
let task: (payload: unknown, helpers: unknown) => Promise<void>;
let mediaTask: (payload: unknown, helpers: unknown) => Promise<void>;
let addJob: ReturnType<typeof vi.fn>;

const query = async (text: string, params: unknown[] = []) =>
  (await pool.query(text, params)).rows;

const helpers = () => ({
  addJob,
  withPgClient: async (callback: (client: unknown) => unknown) => {
    const client = await pool.connect();
    try {
      return await callback(client);
    } finally {
      client.release();
    }
  },
});

const runTask = () => task({ id: connectionId }, helpers());

/** The sync task, then the media job it queued, as the worker would. */
const runBoth = async () => {
  addJob.mockClear();
  await runTask();
  const [name, payload] = addJob.mock.calls[0]!;
  expect(name).toBe("cloud_connection__sync_media");
  await mediaTask(payload, helpers());
};

const lastRun = async () =>
  (
    await query(
      `select * from app_public.cloud_sync_runs
       where cloud_connection_id = $1 order by created_at desc limit 1`,
      [connectionId],
    )
  )[0];

const localProjects = () =>
  query(
    `select p.id, p.cloud_project_id, ${projectSyncValueSql("p")} as value
     from app_public.projects p where p.organization_id = $1 order by p.name`,
    [orgId],
  );

/** Rows as the cloud's `to_jsonb` serializes them. */
const cloudCategory = (name: string) => ({
  id: randomUUID(),
  name,
  organization_id: CLOUD_ORG_ID,
  created_at: "2026-01-01T00:00:00+00:00",
  updated_at: "2026-01-01T00:00:00+00:00",
});
const cloudTag = (name: string) => ({
  id: randomUUID(),
  name,
  description: "",
  background_color: "#123456",
  foreground_color: "#ffffff",
  variant: "solid",
  organization_id: CLOUD_ORG_ID,
  created_at: "2026-01-01T00:00:00+00:00",
  updated_at: "2026-01-01T00:00:00+00:00",
});

beforeAll(async () => {
  pool = poolFromUrl(TEST_DATABASE_URL);
  const { tables } = await introspectCloudSyncTables(pool);
  fake = await startFakeCloud(tables);
  const mod = await import("../src/tasks/cloud_connection__sync");
  task = (mod as any).default ?? mod;
  const media = await import("../src/tasks/cloud_connection__sync_media");
  mediaTask = (media as any).default ?? media;
});

afterAll(async () => {
  await fake.close();
  require("fs").rmSync(uploads, { recursive: true, force: true });
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(async () => {
  resetFakeCloud(fake);
  fake.checkProjectReferences = true;
  addJob = vi.fn();
  [{ id: orgId }] = await query(
    `insert into app_public.organizations (slug, name)
     values ($1, 'Connection sync') returning id`,
    [`${ORG_PREFIX}-${Date.now()}`],
  );
  // Start both sides without the default category.
  await query(`delete from app_public.categories where organization_id = $1`, [
    orgId,
  ]);
  [{ id: connectionId }] = await query(
    `insert into app_public.cloud_connections
       (organization_id, host, session_cookie, session_cookie_expiry, target_organization_slug)
     values ($1, $2, 'session=test', now() + interval '1 day', 'cloudorg')
     returning id`,
    [orgId, fake.url],
  );
});

afterEach(async () => {
  await query(
    `delete from app_public.medias where organization_id in (
       select id from app_public.organizations where slug like $1)`,
    [`${ORG_PREFIX}-%`],
  );
  await query(`delete from app_public.organizations where slug like $1`, [
    `${ORG_PREFIX}-%`,
  ]);
  await deleteTestUsers();
});

describe("cloud_connection__sync", () => {
  const localOrganization = async () =>
    (
      await query(
        `select organization_type, is_public, experimental_features_enabled
         from app_public.organizations where id = $1`,
        [orgId],
      )
    )[0];
  const setLocal = (sql: string) =>
    query(`update app_public.organizations set ${sql} where id = $1`, [orgId]);

  describe("organization settings", () => {
    it("takes the cloud's on the first sync", async () => {
      // Connecting creates the local organization with the defaults
      expect(await localOrganization()).toEqual({
        organization_type: "venue",
        is_public: false,
        experimental_features_enabled: false,
      });
      fake.organization = {
        organizationType: "church",
        isPublic: true,
        experimentalFeaturesEnabled: true,
      };

      await runTask();

      expect(await localOrganization()).toEqual({
        organization_type: "church",
        is_public: true,
        experimental_features_enabled: true,
      });
      expect(fake.organizationPushes).toEqual([]);
    });

    it("pushes an edit made here", async () => {
      await runTask();
      await setLocal("is_public = true");

      await runTask();

      expect(fake.organization).toEqual({
        organizationType: "church",
        isPublic: true,
        experimentalFeaturesEnabled: false,
      });
      // A sync with nothing new changes nothing
      await runTask();
      expect(fake.organizationPushes).toHaveLength(1);
    });

    it("pulls an edit made on the cloud", async () => {
      await runTask();
      fake.organization = { ...fake.organization, organizationType: "venue" };

      await runTask();

      expect(await localOrganization()).toMatchObject({
        organization_type: "venue",
      });
      expect(fake.organizationPushes).toEqual([]);
    });

    it("combines edits made on both sides", async () => {
      await runTask();
      await setLocal("is_public = true");
      fake.organization = {
        ...fake.organization,
        experimentalFeaturesEnabled: true,
      };

      await runTask();

      expect(await localOrganization()).toEqual({
        organization_type: "church",
        is_public: true,
        experimental_features_enabled: true,
      });
      expect(fake.organization).toEqual({
        organizationType: "church",
        isPublic: true,
        experimentalFeaturesEnabled: true,
      });
    });

    it("tries again next sync when the cloud changed during a push", async () => {
      await runTask();
      await setLocal("is_public = true");
      fake.beforeOrganizationPush = () => {
        fake.organization = {
          ...fake.organization,
          experimentalFeaturesEnabled: true,
        };
        fake.beforeOrganizationPush = null;
      };

      await runTask();
      // Refused, so nothing here moves yet
      expect(await localOrganization()).toEqual({
        organization_type: "church",
        is_public: true,
        experimental_features_enabled: false,
      });
      expect(await lastRun()).toMatchObject({ status: "completed" });

      await runTask();
      expect(await localOrganization()).toEqual({
        organization_type: "church",
        is_public: true,
        experimental_features_enabled: true,
      });
      expect(fake.organization).toEqual({
        organizationType: "church",
        isPublic: true,
        experimentalFeaturesEnabled: true,
      });
    });
  });

  it("pulls a project and the category and tags it names, in one run", async () => {
    const cloudId = randomUUID();
    fake.tables.set("app_public.categories", [cloudCategory("Youth")]);
    fake.tables.set("app_public.tags", [cloudTag("drums")]);
    fake.projects.push({
      id: cloudId,
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: fake.now(),
      value: {
        name: "Camp",
        targetDate: null,
        category: "Youth",
        tags: ["drums"],
      },
    });

    await runTask();

    expect(await localProjects()).toEqual([
      expect.objectContaining({
        cloud_project_id: cloudId,
        value: {
          name: "Camp",
          targetDate: null,
          category: "Youth",
          tags: ["drums"],
        },
      }),
    ]);
    // The tag arrives whole, not just its name.
    expect(
      await query(
        `select background_color from app_public.tags
         where organization_id = $1`,
        [orgId],
      ),
    ).toEqual([{ background_color: "#123456" }]);
    expect(await lastRun()).toMatchObject({
      status: "completed",
      total_projects: 1,
      projects_to_sync: 1,
      synced_projects: 1,
      failed_projects: 0,
      added_projects: 1,
      updated_projects: 0,
      deleted_projects: 0,
      error: null,
    });
    expect(addJob).toHaveBeenCalledWith(
      "cloud_connection__sync_media",
      expect.objectContaining({ externalProjectIds: [cloudId] }),
      { queueName: `cloud_sync_media:${connectionId}` },
    );
  });

  describe("live runs", () => {
    const runLive = () =>
      task({ id: connectionId, trigger: "local_change", media: false }, helpers());

    it("skips the media sync when not asked for it", async () => {
      await runLive();

      expect(addJob).not.toHaveBeenCalled();
      expect(await lastRun()).toMatchObject({
        status: "completed",
        media_status: "synced",
      });
    });

    it("records why it ran", async () => {
      await runLive();
      expect(await lastRun()).toMatchObject({ trigger: "local_change" });

      // A job queued before the trigger was recorded.
      await runTask();
      expect(await lastRun()).toMatchObject({ trigger: null });
    });

    it("still syncs media when a project arrives", async () => {
      fake.projects.push({
        id: randomUUID(),
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: fake.now(),
        value: { name: "New", targetDate: null, category: null, tags: [] },
      });

      await runLive();

      expect(addJob).toHaveBeenCalledWith(
        "cloud_connection__sync_media",
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe("run records", () => {
    /** Started `ageHours` ago, a minute apart. */
    const addRuns = async (
      count: number,
      { completed = true, ageHours = 0 } = {},
    ) => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        // Or the timestamps trigger sets `created_at` to now.
        await client.query("set local session_replication_role = replica");
        await client.query(
          `insert into app_public.cloud_sync_runs
             (organization_id, cloud_connection_id, status, created_at, completed_at)
           select $1, $2, 'completed',
                  now() - make_interval(hours => $5, mins => n),
                  case when $4 then now() end
           from generate_series(1, $3) n`,
          [orgId, connectionId, count, completed, ageHours],
        );
        await client.query("commit");
      } finally {
        client.release();
      }
    };
    const runCount = async () =>
      (
        await query(
          `select count(*)::int as count from app_public.cloud_sync_runs
           where cloud_connection_id = $1`,
          [connectionId],
        )
      )[0].count;

    it("keeps only the latest 100 per connection", async () => {
      await addRuns(150);

      await runTask();

      expect(await runCount()).toBe(100);
      expect(await lastRun()).toMatchObject({ status: "completed" });
    });

    it("keeps unfinished ones, whose media job may still update them", async () => {
      await addRuns(100);
      await addRuns(5, { completed: false, ageHours: 2 });

      await runTask();

      expect(await runCount()).toBe(105);
    });

    it("deletes unfinished ones a day old, left by a worker that died", async () => {
      await addRuns(100);
      await addRuns(5, { completed: false, ageHours: 25 });

      await runTask();

      expect(await runCount()).toBe(100);
    });
  });

  describe("document bridges", () => {
    let listener: import("pg").PoolClient;
    let notified: string[];

    beforeEach(async () => {
      notified = [];
      listener = await pool.connect();
      listener.on("notification", (msg) => {
        if (msg.channel === "cloud_bridge") notified.push(msg.payload!);
      });
      await listener.query("listen cloud_bridge");
    });
    afterEach(async () => {
      await listener.query("unlisten cloud_bridge");
      // Pooled: the next test may get the same client.
      listener.removeAllListeners("notification");
      listener.release();
    });
    // Notifications arrive before the answer to a later query.
    const settle = () => listener.query("select 1");

    it("says so when a project created here gets its cloud copy", async () => {
      await query(
        `insert into app_public.projects (organization_id, slug, name)
         values ($1, 'n', 'New here')`,
        [orgId],
      );

      await runTask();
      await settle();

      expect(notified).toEqual([connectionId]);
    });

    it("says so when the cloud deleted a project", async () => {
      const cloudId = randomUUID();
      fake.projects.push({
        id: cloudId,
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: fake.now(),
        value: { name: "Doomed", targetDate: null, category: null, tags: [] },
      });
      await runTask();
      await settle();
      notified = [];
      fake.projects.splice(0);

      await runTask();
      await settle();

      expect(await localProjects()).toEqual([]);
      expect(notified).toEqual([connectionId]);
    });

    it("stays quiet when nothing was connected or deleted", async () => {
      await runTask();
      await settle();

      expect(notified).toEqual([]);
    });
  });

  it("pushes a project and the category and tags it names, in one run", async () => {
    await query(
      `insert into app_public.categories (organization_id, name)
       values ($1, 'Weddings')`,
      [orgId],
    );
    await query(
      `insert into app_public.tags (organization_id, name) values ($1, 'strings')`,
      [orgId],
    );
    const [{ id: localId }] = await query(
      `insert into app_public.projects (organization_id, slug, name, category_id)
       values ($1, 'w', 'Wedding',
         (select id from app_public.categories where organization_id = $1))
       returning id`,
      [orgId],
    );
    await query(
      `insert into app_public.project_tags (project_id, tag_id)
       select $1, id from app_public.tags where organization_id = $2`,
      [localId, orgId],
    );

    await runTask();

    // The fake rejects a project naming anything it lacks, as the cloud does.
    expect(fake.projects).toMatchObject([
      {
        id: localId,
        value: {
          name: "Wedding",
          targetDate: null,
          category: "Weddings",
          tags: ["strings"],
        },
      },
    ]);
    expect(fake.requests.indexOf("cloudPluginTablePush")).toBeLessThan(
      fake.requests.indexOf("cloudProjectSyncPush"),
    );
    expect(await lastRun()).toMatchObject({ status: "completed" });
  });

  describe("renames, which sync as a delete and a create", () => {
    let projectId: string;

    /** One project in category "Sunday" with tag "band", synced. */
    beforeEach(async () => {
      await query(
        `insert into app_public.categories (organization_id, name)
         values ($1, 'Sunday')`,
        [orgId],
      );
      await query(
        `insert into app_public.tags (organization_id, name)
         values ($1, 'band')`,
        [orgId],
      );
      [{ id: projectId }] = await query(
        `insert into app_public.projects (organization_id, slug, name, category_id)
         values ($1, 'e', 'Easter',
           (select id from app_public.categories where organization_id = $1))
         returning id`,
        [orgId],
      );
      await query(
        `insert into app_public.project_tags (project_id, tag_id)
         select $1, id from app_public.tags where organization_id = $2`,
        [projectId, orgId],
      );
      await runTask();
      expect(fake.projects[0]!.value).toMatchObject({
        category: "Sunday",
        tags: ["band"],
      });
    });

    const expectBothSides = async (category: string, tags: string[]) => {
      expect(fake.projects[0]!.value).toMatchObject({ category, tags });
      expect((await localProjects())[0].value).toMatchObject({
        category,
        tags,
      });
      const names = (entity: string) =>
        (fake.tables.get(entity) ?? []).map((r) => r.name);
      expect(names("app_public.categories")).toEqual([category]);
      expect(names("app_public.tags")).toEqual(tags);
      expect(
        await query(
          "select name from app_public.categories where organization_id = $1",
          [orgId],
        ),
      ).toEqual([{ name: category }]);
      expect(
        await query(
          "select name from app_public.tags where organization_id = $1",
          [orgId],
        ),
      ).toEqual(tags.map((name) => ({ name })));
    };

    it("keeps projects in a category renamed here", async () => {
      await query(
        `update app_public.categories set name = 'Sunday AM'
         where organization_id = $1`,
        [orgId],
      );

      await runTask();

      await expectBothSides("Sunday AM", ["band"]);
    });

    it("keeps projects tagged with a tag renamed here", async () => {
      await query(
        `update app_public.tags set name = 'Band' where organization_id = $1`,
        [orgId],
      );

      await runTask();

      await expectBothSides("Sunday", ["Band"]);
    });

    it("keeps a category renamed here and a project renamed on the cloud", async () => {
      await query(
        `update app_public.categories set name = 'Sunday AM'
         where organization_id = $1`,
        [orgId],
      );
      fake.projects[0]!.value = {
        ...fake.projects[0]!.value,
        name: "Easter Day",
      };
      fake.projects[0]!.updatedAt = fake.now();

      await runTask();

      await expectBothSides("Sunday AM", ["band"]);
      expect(fake.projects[0]!.value.name).toBe("Easter Day");
      expect((await localProjects())[0].value.name).toBe("Easter Day");
    });

    it("keeps a tag renamed on the cloud and a project renamed here", async () => {
      const [row] = fake.tables.get("app_public.tags")!;
      fake.tables.set("app_public.tags", [
        { ...row, name: "Band", updated_at: fake.now() },
      ]);
      fake.projects[0]!.value = { ...fake.projects[0]!.value, tags: ["Band"] };
      await query(
        "update app_public.projects set name = 'Easter Day' where id = $1",
        [projectId],
      );

      await runTask();

      await expectBothSides("Sunday", ["Band"]);
      expect(fake.projects[0]!.value.name).toBe("Easter Day");
      expect((await localProjects())[0].value.name).toBe("Easter Day");
    });

    it("keeps deleted a project the cloud deleted while renaming its category", async () => {
      const [row] = fake.tables.get("app_public.categories")!;
      fake.tables.set("app_public.categories", [
        { ...row, name: "Sunday AM", updated_at: fake.now() },
      ]);
      fake.projects = [];

      await runTask();

      expect(await localProjects()).toEqual([]);
      expect(fake.projects).toEqual([]);
    });

    it("follows a category and a tag renamed on the cloud", async () => {
      // A rename on the cloud changes the projects' values, not their
      // `updated_at`.
      const rename = (entity: string, name: string) => {
        const [row] = fake.tables.get(entity)!;
        fake.tables.set(entity, [{ ...row, name, updated_at: fake.now() }]);
      };
      rename("app_public.categories", "Sunday AM");
      rename("app_public.tags", "Band");
      fake.projects[0]!.value = {
        ...fake.projects[0]!.value,
        category: "Sunday AM",
        tags: ["Band"],
      };

      await runTask();

      await expectBothSides("Sunday AM", ["Band"]);
    });
  });

  describe("with media", () => {
    const PLUGIN_ID = "b1000000-0000-4000-8000-000000000001";
    let projectId: string;
    let mediaName: string;
    let mediaId: string;

    /** A project here using a PDF page, synced. */
    beforeEach(async () => {
      [{ id: projectId }] = await query(
        `insert into app_public.projects (organization_id, slug, name)
         values ($1, 'p', 'Slides') returning id`,
        [orgId],
      );
      const { media, cloud } = await import("@repo/backend-shared");
      const handler = new media.file.mediaHandler(async (callback) => {
        const client = await pool.connect();
        try {
          return await callback(client);
        } finally {
          client.release();
        }
      });
      const id = (await import("typeid-js")).typeidUnboxed("media");
      mediaName = `${id}.jpg`;
      await handler.uploadMedia({
        file: (await import("stream")).Readable.from(Buffer.from("page 1")),
        fileExtension: "jpg",
        fileSize: 6,
        userId: null,
        organizationId: orgId,
        mediaId: id,
        isUserUploaded: false,
        skipProcessing: true,
      });
      [{ id: mediaId }] = await query(
        "select id from app_public.medias where media_name = $1",
        [mediaName],
      );
      await query(
        `insert into app_public.project_medias (project_id, media_id, plugin_id)
         values ($1, $2, $3)`,
        [projectId, mediaId, PLUGIN_ID],
      );
      expect(cloud.syncMedia).toBeDefined();
      await runBoth();
      expect(fake.files.get(mediaName)?.toString()).toBe("page 1");
      expect(fake.mediaLinks).toEqual([
        { projectId, mediaId, pluginId: PLUGIN_ID },
      ]);
    });

    it("records the transfers on the run", async () => {
      expect(await lastRun()).toMatchObject({
        media_status: "synced",
        total_media: 1,
        synced_media: 1,
        total_bytes: "6",
        downloaded_bytes: "6",
      });
    });

    it("brings back a project the cloud deleted, using media still on the cloud", async () => {
      // The page was only linked, not deleted: say it is used elsewhere.
      fake.projects = [];
      fake.mediaLinks = [];
      await query(
        "update app_public.projects set name = 'Kept' where id = $1",
        [projectId],
      );

      await runBoth();

      expect(fake.mediaLinks).toEqual([
        { projectId, mediaId, pluginId: PLUGIN_ID },
      ]);
      expect(
        await query(
          "select media_id from app_public.project_medias where project_id = $1",
          [projectId],
        ),
      ).toEqual([{ media_id: mediaId }]);
    });

    it("brings back a project the cloud deleted but edited here, media and all", async () => {
      // Deleted on the cloud: its links go with it, then the page, unused.
      fake.projects = [];
      fake.mediaLinks = [];
      fake.media = [];
      fake.files.clear();
      await query(
        "update app_public.projects set name = 'Kept' where id = $1",
        [projectId],
      );

      await runBoth();

      expect(fake.projects.map((p) => p.id)).toEqual([projectId]);
      expect(fake.files.get(mediaName)?.toString()).toBe("page 1");
      expect(fake.mediaLinks).toEqual([
        { projectId, mediaId, pluginId: PLUGIN_ID },
      ]);
      expect(
        await query(
          "select media_id from app_public.project_medias where project_id = $1",
          [projectId],
        ),
      ).toEqual([{ media_id: mediaId }]);
    });
  });

  it("fails the run, changing nothing, when the organization is not found", async () => {
    await query(
      `insert into app_public.projects (organization_id, slug, name, cloud_project_id)
       values ($1, 'k', 'Kept', $2)`,
      [orgId, randomUUID()],
    );
    fake.orgMissing = true;

    await runTask();

    expect(await localProjects()).toHaveLength(1);
    expect(await lastRun()).toMatchObject({
      status: "failed",
      error: expect.stringContaining("Organization not found"),
    });
    expect(addJob).not.toHaveBeenCalled();
  });

  it("fails the run when the cloud predates project sync", async () => {
    fake.unsupported = true;

    await runTask();

    expect(await lastRun()).toMatchObject({ status: "failed" });
    expect(addJob).not.toHaveBeenCalled();
  });

  it("counts failed document merges on the run", async () => {
    const cloudId = randomUUID();
    fake.projects.push({
      id: cloudId,
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: fake.now(),
      value: { name: "Broken", targetDate: null, category: null, tags: [] },
    });
    fake.failDocuments.add(cloudId);

    await runTask();

    expect(await lastRun()).toMatchObject({
      synced_projects: 0,
      failed_projects: 1,
    });
  });
});
