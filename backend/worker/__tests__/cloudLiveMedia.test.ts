import { uuidFromMediaId } from "@repo/lib";
import { Pool } from "pg";
import { Readable } from "stream";
import { typeidUnboxed } from "typeid-js";
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

import { TEST_DATABASE_URL, poolFromUrl } from "../../__tests__/helpers";
import { introspectCloudSyncTables } from "../../backend-shared/src/cloud/sync/pluginTables/introspection";
import { FakeCloud, resetFakeCloud, startFakeCloud } from "./helpers/fakeCloud";

// Media go to a file store in a temporary directory, read when it loads.
const { uploads, previousEnv } = vi.hoisted(() => {
  const dir = require("fs").mkdtempSync(
    require("path").join(require("os").tmpdir(), "live-media-"),
  );
  const previousEnv = {
    STORAGE_TYPE: process.env.STORAGE_TYPE,
    UPLOADS_PATH: process.env.UPLOADS_PATH,
  };
  process.env.STORAGE_TYPE = "file";
  process.env.UPLOADS_PATH = dir;
  return { uploads: dir, previousEnv };
});

// The tasks and the server import the package, whose `dist` may be stale.
vi.mock(
  "@repo/backend-shared",
  async () => await import("../../backend-shared/src"),
);
// The server's app module starts everything; the listener only needs this.
vi.mock("../../server/src/app", () => ({
  getShutdownActions: (app: { get(key: string): unknown }) =>
    app.get("shutdownActions"),
}));

/**
 * Live media sync end to end, in process: the server's listener (as the
 * studio runs it) hears a media change here or the cloud's hint, queues the
 * media sync, and the worker's tasks, run by hand, move the file.
 *
 * The e2e servers cannot cover this: they share one database, where a media
 * that keeps its id on both sides cannot be in two orgs.
 */

const ORG_PREFIX = "testcloudlivemedia";

let pool: Pool;
let fake: FakeCloud;
let orgId: string;
let connectionId: string;
let syncTask: (payload: unknown, helpers: unknown) => Promise<void>;
let mediaTask: (payload: unknown, helpers: unknown) => Promise<void>;
let handler: { uploadMedia: (options: any) => Promise<unknown> };
const shutdownActions: (() => unknown)[] = [];

const query = async (text: string, params: unknown[] = []) =>
  (await pool.query(text, params)).rows;

const withPgClient = async <T>(callback: (client: any) => Promise<T>) => {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
};

const queuedSyncs = () =>
  query(
    // The public view leaves out the payload.
    `select j.key, p.payload
     from graphile_worker.jobs j
     join graphile_worker._private_jobs p on p.id = j.id
     where j.key like $1 order by j.key`,
    [`cloud_connection__sync:${connectionId}%`],
  );

const removeQueuedSyncs = () =>
  query(
    `select graphile_worker.remove_job(key) from graphile_worker.jobs
     where key like $1`,
    [`cloud_connection__sync:${connectionId}%`],
  );

/** Wait for the listener to queue one sync, then run it as the worker would. */
const runQueuedSync = async () => {
  await vi.waitFor(async () => expect(await queuedSyncs()).toHaveLength(1), {
    timeout: 5000,
  });
  const [job] = await queuedSyncs();
  await removeQueuedSyncs();

  const addJob = vi.fn();
  await syncTask(job.payload, { addJob, withPgClient });
  for (const [name, payload] of addJob.mock.calls) {
    if (name === "cloud_connection__sync_media") {
      await mediaTask(payload, { addJob: vi.fn(), withPgClient });
    }
  }
  return job;
};

/** Long enough for a hint from the sync's own writes to have been queued. */
const expectSettled = async () => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(await queuedSyncs()).toEqual([]);
};

const newMediaName = () => `${typeidUnboxed("media")}.jpg`;
const idOf = (mediaName: string) => uuidFromMediaId(mediaName.split(".")[0]!);

beforeAll(async () => {
  pool = poolFromUrl(TEST_DATABASE_URL);
  const { tables } = await introspectCloudSyncTables(pool);
  fake = await startFakeCloud(tables);

  const sync = await import("../src/tasks/cloud_connection__sync");
  syncTask = (sync as any).default ?? sync;
  const media = await import("../src/tasks/cloud_connection__sync_media");
  mediaTask = (media as any).default ?? media;
  const shared = await import("@repo/backend-shared");
  handler = new shared.media.file.mediaHandler(withPgClient);

  const settings = new Map<string, unknown>([
    ["rootPgPool", pool],
    ["shutdownActions", shutdownActions],
  ]);
  const { default: installCloudSyncLive } = await import(
    "../../server/src/middleware/installCloudSyncLive"
  );
  await installCloudSyncLive({ get: (key: string) => settings.get(key) } as any);
});

afterAll(async () => {
  for (const action of shutdownActions) await action();
  await fake.close();
  require("fs").rmSync(uploads, { recursive: true, force: true });
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(async () => {
  resetFakeCloud(fake);
  [{ id: orgId }] = await query(
    `insert into app_public.organizations (slug, name)
     values ($1, 'Live media') returning id`,
    [`${ORG_PREFIX}-${Date.now()}`],
  );
  [{ id: connectionId }] = await query(
    `insert into app_public.cloud_connections
       (organization_id, host, session_cookie, session_cookie_expiry, target_organization_slug)
     values ($1, $2, 'session=test', now() + interval '1 day', 'cloudorg')
     returning id`,
    [orgId, fake.url],
  );
  // The listener picks up the new connection and subscribes to the cloud.
  await vi.waitFor(() => expect(fake.hintSubscribers).toBe(1), {
    timeout: 5000,
  });
});

afterEach(async () => {
  await removeQueuedSyncs();
  await query(
    `delete from app_public.medias where organization_id in (
       select id from app_public.organizations where slug like $1)`,
    [`${ORG_PREFIX}-%`],
  );
  await query(`delete from app_public.organizations where slug like $1`, [
    `${ORG_PREFIX}-%`,
  ]);
  // The listener drops the subscription with the connection.
  await vi.waitFor(() => expect(fake.hintSubscribers).toBe(0), {
    timeout: 5000,
  });
});

describe("live media sync", () => {
  it("uploads media added here, with no sync asked for", async () => {
    const mediaName = newMediaName();
    await handler.uploadMedia({
      file: Readable.from(Buffer.from("added here")),
      fileExtension: "jpg",
      fileSize: 10,
      userId: null,
      organizationId: orgId,
      mediaId: mediaName.split(".")[0],
      originalFileName: "added.jpg",
      isUserUploaded: true,
      skipProcessing: true,
    });

    const job = await runQueuedSync();

    expect(job.key).toBe(`cloud_connection__sync:${connectionId}:media`);
    expect(job.payload).toMatchObject({ trigger: "local_media_change" });
    expect(fake.files.get(mediaName)?.toString()).toBe("added here");
    expect(fake.media.map((m) => m.mediaName)).toEqual([mediaName]);
    await expectSettled();
  });

  it("downloads media the cloud says it added", async () => {
    const mediaName = newMediaName();
    fake.files.set(mediaName, Buffer.from("added on the cloud"));
    fake.media.push({
      id: idOf(mediaName),
      mediaName,
      fileSize: "18",
      originalName: "cloud.jpg",
      fileExtension: "jpg",
      isUserUploaded: true,
    });

    fake.hint("app_public.medias");
    const job = await runQueuedSync();

    expect(job.key).toBe(`cloud_connection__sync:${connectionId}:media`);
    expect(job.payload).toMatchObject({ trigger: "cloud_media_change" });
    expect(
      await query(
        `select media_name, is_complete, organization_id
         from app_public.medias where id = $1`,
        [idOf(mediaName)],
      ),
    ).toEqual([{ media_name: mediaName, is_complete: true, organization_id: orgId }]);
    // The download is the sync's own write: no sync back up.
    await expectSettled();
  });

  it("ignores the cloud's hint about its own upload", async () => {
    fake.hint("app_public.medias", connectionId);

    await expectSettled();
  });
});
