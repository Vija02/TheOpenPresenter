import { randomUUID } from "crypto";
import { Client, Pool } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { TEST_DATABASE_URL, poolFromUrl } from "../../__tests__/helpers";
import {
  queueCloudSync,
  withCloudSyncOrigin,
} from "../../backend-shared/src/cloud/sync/queue";

/**
 * What live sync is built on: the change hints the database sends, the
 * origin that marks a sync's own writes, and how syncs are queued.
 */

const ORG_PREFIX = "testcloudsynclive";

let pool: Pool;
let listener: Client;
let notifications: { channel: string; payload?: string }[] = [];
let orgId: string;

const query = async (text: string, params: unknown[] = []) =>
  (await pool.query(text, params)).rows;

/** Hints sent to this organization so far. */
const hints = async () => {
  // Notifications committed before this round trip arrive before its answer.
  await listener.query("select 1");
  return notifications
    .filter((n) => n.channel === `cloud_sync:${orgId}`)
    .map((n) => JSON.parse(n.payload!));
};

/** Forget the hints so far, once they have all arrived. */
const clearHints = async () => {
  await hints();
  notifications = [];
};

const withPgClient = async <T>(callback: (client: any) => Promise<T>) => {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
};

const createProject = async (name = "Service") =>
  (
    await query(
      `insert into app_public.projects (organization_id, slug, name)
       values ($1, $2, $3) returning id`,
      [orgId, `p-${randomUUID()}`, name],
    )
  )[0].id as string;

beforeAll(async () => {
  pool = poolFromUrl(TEST_DATABASE_URL);
  listener = new Client({ connectionString: TEST_DATABASE_URL });
  await listener.connect();
  listener.on("notification", (n) => notifications.push(n));
});

afterAll(async () => {
  await listener.end();
});

beforeEach(async () => {
  [{ id: orgId }] = await query(
    `insert into app_public.organizations (slug, name)
     values ($1, 'Live sync') returning id`,
    [`${ORG_PREFIX}-${Date.now()}`],
  );
  // Only organizations with a connection are hinted.
  await query(
    `insert into app_public.cloud_connections
       (organization_id, host, session_cookie, session_cookie_expiry, target_organization_slug)
     values ($1, 'http://cloud.invalid', 'session=test', now() + interval '1 day', 'cloudorg')`,
    [orgId],
  );
  await listener.query(`LISTEN "cloud_sync:${orgId}"`);
  notifications = [];
});

afterEach(async () => {
  await listener.query("UNLISTEN *");
  await query(
    `delete from app_public.medias where organization_id in (
       select id from app_public.organizations where slug like $1)`,
    [`${ORG_PREFIX}-%`],
  );
  await query(`delete from app_public.organizations where slug like $1`, [
    `${ORG_PREFIX}-%`,
  ]);
});

describe("change hints", () => {
  it("sends nothing for an organization without a connection", async () => {
    const [{ id: unconnected }] = await query(
      `insert into app_public.organizations (slug, name)
       values ($1, 'Not connected') returning id`,
      [`${ORG_PREFIX}-unconnected-${Date.now()}`],
    );
    await listener.query(`LISTEN "cloud_sync:${unconnected}"`);

    await query(
      `insert into app_public.categories (organization_id, name)
       values ($1, 'Youth')`,
      [unconnected],
    );
    await listener.query("select 1");

    expect(
      notifications.filter((n) => n.channel === `cloud_sync:${unconnected}`),
    ).toEqual([]);
  });

  it("hints an organization with a studio listening, as the cloud does", async () => {
    const [{ id: cloudOrg }] = await query(
      `insert into app_public.organizations (slug, name)
       values ($1, 'On the cloud') returning id`,
      [`${ORG_PREFIX}-cloud-${Date.now()}`],
    );
    await listener.query(`LISTEN "cloud_sync:${cloudOrg}"`);
    const write = () =>
      query(
        `insert into app_public.categories (organization_id, name)
         values ($1, $2)`,
        [cloudOrg, randomUUID()],
      );
    const cloudHints = async () => {
      await listener.query("select 1");
      return notifications.filter((n) => n.channel === `cloud_sync:${cloudOrg}`);
    };

    await write();
    expect(await cloudHints()).toEqual([]);

    // Said so too long ago: gone quiet.
    await query(
      `insert into app_private.cloud_sync_presence (organization_id, seen_at)
       values ($1, now() - interval '2 minutes')`,
      [cloudOrg],
    );
    await write();
    expect(await cloudHints()).toEqual([]);

    await query(
      `update app_private.cloud_sync_presence set seen_at = now()
       where organization_id = $1`,
      [cloudOrg],
    );
    await write();

    expect(await cloudHints()).toHaveLength(1);
  });

  it("hints a project created, renamed and deleted here", async () => {
    const id = await createProject();
    await query(`update app_public.projects set name = 'Renamed' where id = $1`, [
      id,
    ]);
    await query(`delete from app_public.projects where id = $1`, [id]);

    expect(await hints()).toEqual([
      { entity: "app_public.projects", origin: null },
      { entity: "app_public.projects", origin: null },
      { entity: "app_public.projects", origin: null },
    ]);
  });

  it("does not hint a project's document save", async () => {
    const id = await createProject();
    await clearHints();

    await query(`update app_public.projects set updated_at = now() where id = $1`, [
      id,
    ]);

    expect(await hints()).toEqual([]);
  });

  it("hints a tag on a project, through the project's organization", async () => {
    const id = await createProject();
    const [{ id: tagId }] = await query(
      `insert into app_public.tags (organization_id, name)
       values ($1, 'drums') returning id`,
      [orgId],
    );
    await clearHints();

    await query(
      `insert into app_public.project_tags (project_id, tag_id) values ($1, $2)`,
      [id, tagId],
    );

    expect(await hints()).toEqual([
      { entity: "app_public.project_tags", origin: null },
    ]);
  });

  it("hints a @cloudSync table", async () => {
    await query(
      `insert into app_public.categories (organization_id, name)
       values ($1, 'Youth')`,
      [orgId],
    );

    expect(await hints()).toContainEqual({
      entity: "app_public.categories",
      origin: null,
    });
  });

  it("sends one hint for many rows changed at once", async () => {
    await query(
      `insert into app_public.categories (organization_id, name)
       select $1, 'Category ' || i from generate_series(1, 20) i`,
      [orgId],
    );

    expect(await hints()).toEqual([
      { entity: "app_public.categories", origin: null },
    ]);
  });

  it("hints media only once the upload is complete", async () => {
    const [{ id }] = await query(
      `insert into app_public.medias
         (organization_id, media_name, file_offset, is_complete)
       values ($1, $2, 0, false) returning id`,
      [orgId, `${randomUUID()}.png`],
    );
    await query(`update app_public.medias set file_offset = 10 where id = $1`, [
      id,
    ]);
    expect(await hints()).toEqual([]);

    await query(`update app_public.medias set is_complete = true where id = $1`, [
      id,
    ]);

    expect(await hints()).toEqual([
      { entity: "app_public.medias", origin: null },
    ]);
  });

  it("marks a sync's own writes with its connection", async () => {
    const connectionId = randomUUID();
    const sync = withCloudSyncOrigin(withPgClient, connectionId);

    await sync((client) =>
      client.query(
        `insert into app_public.categories (organization_id, name)
         values ($1, 'Pulled')`,
        [orgId],
      ),
    );
    await createProject();

    expect(await hints()).toEqual([
      { entity: "app_public.categories", origin: connectionId },
      { entity: "app_public.projects", origin: null },
    ]);
  });
});

describe("withCloudSyncOrigin", () => {
  let single: Pool;
  beforeAll(() => {
    // One client, so the next checkout is the same connection.
    single = new Pool({ connectionString: TEST_DATABASE_URL, max: 1 });
  });
  afterAll(() => single.end());

  const withSingle = async <T>(callback: (client: any) => Promise<T>) => {
    const client = await single.connect();
    try {
      return await callback(client);
    } finally {
      client.release();
    }
  };
  const originAfter = async () =>
    (
      await single.query(
        `select current_setting('app.cloud_sync_origin', true) as origin`,
      )
    ).rows[0].origin;

  it("leaves the connection untagged after", async () => {
    await withCloudSyncOrigin(withSingle, randomUUID())((client) =>
      client.query("select 1"),
    );

    expect(await originAfter()).toBe("");
  });

  it("leaves it untagged after a failure mid-transaction", async () => {
    const failing = withCloudSyncOrigin(withSingle, randomUUID())(
      async (client) => {
        await client.query("begin");
        await client.query("select 1/0");
      },
    );

    await expect(failing).rejects.toThrow(/division by zero/);
    expect(await originAfter()).toBe("");
  });
});

describe("queueCloudSync", () => {
  let connectionId: string;
  beforeEach(() => {
    connectionId = randomUUID();
  });
  afterEach(async () => {
    await query(
      `select graphile_worker.remove_job(key) from graphile_worker.jobs
       where key like $1`,
      [`cloud_connection__sync:${connectionId}%`],
    );
  });

  const jobs = () =>
    query(
      // The public view leaves out the payload.
      `select j.key, j.queue_name, p.payload, j.run_at > now() as delayed
       from graphile_worker.jobs j
       join graphile_worker._private_jobs p on p.id = j.id
       where j.key like $1 order by j.key`,
      [`cloud_connection__sync:${connectionId}%`],
    );

  it("folds live changes into one delayed job", async () => {
    await queueCloudSync(pool, connectionId, { trigger: "local_change" });
    await queueCloudSync(pool, connectionId, { trigger: "local_change" });

    expect(await jobs()).toEqual([
      {
        key: `cloud_connection__sync:${connectionId}:live`,
        queue_name: `cloud_sync:${connectionId}`,
        payload: { id: connectionId, trigger: "local_change", media: false },
        delayed: true,
      },
    ]);
  });

  it("keeps a full sync apart from live ones, in the same queue", async () => {
    await queueCloudSync(pool, connectionId, {
      trigger: "manual",
      forceResync: true,
    });
    await queueCloudSync(pool, connectionId, { trigger: "local_change" });
    await queueCloudSync(pool, connectionId, {
      trigger: "local_media_change",
    });

    expect(await jobs()).toEqual([
      {
        key: `cloud_connection__sync:${connectionId}`,
        queue_name: `cloud_sync:${connectionId}`,
        payload: {
          id: connectionId,
          trigger: "manual",
          media: true,
          force_resync: true,
        },
        delayed: false,
      },
      expect.objectContaining({
        key: `cloud_connection__sync:${connectionId}:live`,
        queue_name: `cloud_sync:${connectionId}`,
      }),
      expect.objectContaining({
        key: `cloud_connection__sync:${connectionId}:media`,
        queue_name: `cloud_sync:${connectionId}`,
        payload: expect.objectContaining({ media: true }),
      }),
    ]);
  });
});
