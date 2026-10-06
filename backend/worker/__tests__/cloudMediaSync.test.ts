import { mediaIdFromUUID, uuidFromMediaId } from "@repo/lib";
import { randomUUID } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
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

import {
  TEST_DATABASE_URL,
  deleteTestUsers,
  poolFromUrl,
} from "../../__tests__/helpers";
import type { MediaHandlerInterface } from "../../backend-shared/src/media/types";
import { WithPgClient } from "../../backend-shared/src/types";
import { FakeCloud, resetFakeCloud, startFakeCloud } from "./helpers/fakeCloud";

// The file store reads this when its module loads.
const { uploads, previousUploadsPath } = vi.hoisted(() => {
  const dir = require("fs").mkdtempSync(
    require("path").join(require("os").tmpdir(), "media-sync-"),
  );
  const previousUploadsPath = process.env.UPLOADS_PATH;
  process.env.UPLOADS_PATH = dir;
  return { uploads: dir, previousUploadsPath };
});

/**
 * Media sync's local half, against a real database and file store and a
 * fake cloud with tus uploads and `/media/data` downloads.
 */

const ORG_PREFIX = "testmediasync";

let pool: Pool;
let fake: FakeCloud;
let orgId: string;
let handler: MediaHandlerInterface;
let syncMedia: typeof import("../../backend-shared/src/cloud/sync/media/sync").syncMedia;
let connection: {
  id: string;
  host: string;
  session_cookie: string;
  organization_id: string;
  target_organization_slug: string;
  creator_user_id: string | null;
};
let cloudProjectId: string;
let localProjectId: string;
const PLUGIN_ID = "b1000000-0000-4000-8000-000000000001";

const withPgClient: WithPgClient = async (callback) => {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
};

const query = async (text: string, params: unknown[] = []) =>
  (await pool.query(text, params)).rows;

/**
 * Sync, then check what must hold after any sync: a media on both sides is
 * the same kind on both. Whether it was uploaded by someone or made by a
 * plugin decides whether it is cleaned up once unused.
 */
const sync = async (projectIds = [cloudProjectId]) => {
  const result = await syncMedia(withPgClient, connection, {
    mediaHandler: handler,
    projectIds,
  });
  const local = await query(
    `select id, is_user_uploaded from app_public.medias where organization_id = $1`,
    [orgId],
  );
  const onBoth = local.filter((l) => fake.media.some((m) => m.id === l.id));
  expect(
    onBoth.map((l) => ({ id: l.id, userUploaded: l.is_user_uploaded })),
  ).toEqual(
    onBoth.map((l) => ({
      id: l.id,
      userUploaded: fake.media.find((m) => m.id === l.id)!.isUserUploaded,
    })),
  );
  return result;
};

const newMediaName = (extension: string) =>
  `${typeidUnboxed("media")}.${extension}`;
const idOf = (mediaName: string) => uuidFromMediaId(mediaName.split(".")[0]!);

/** A complete media file here. */
const createLocal = async (
  content: string,
  { extension = "jpg", userUploaded = true } = {},
) => {
  const mediaName = newMediaName(extension);
  const data = Buffer.from(content);
  await handler.uploadMedia({
    file: Readable.from(data),
    fileExtension: extension,
    fileSize: data.length,
    userId: null,
    organizationId: orgId,
    mediaId: mediaName.split(".")[0],
    originalFileName: `${content}.${extension}`,
    isUserUploaded: userUploaded,
    skipProcessing: true,
  });
  return { id: idOf(mediaName), mediaName };
};

/** A complete media file on the cloud. */
const createOnCloud = (
  content: string,
  { extension = "jpg", userUploaded = true } = {},
) => {
  const mediaName = newMediaName(extension);
  const data = Buffer.from(content);
  fake.files.set(mediaName, data);
  fake.media.push({
    id: idOf(mediaName),
    mediaName,
    fileSize: String(data.length),
    originalName: `${content}.${extension}`,
    fileExtension: extension,
    isUserUploaded: userUploaded,
  });
  return { id: idOf(mediaName), mediaName };
};

const localFile = async (mediaName: string) => {
  const rows = await query(
    "select is_user_uploaded from app_public.medias where media_name = $1",
    [mediaName],
  );
  if (rows.length === 0) return null;
  const chunks: Buffer[] = [];
  for await (const chunk of await handler.getReadable(mediaName)) {
    chunks.push(chunk as Buffer);
  }
  return {
    content: Buffer.concat(chunks).toString(),
    userUploaded: rows[0].is_user_uploaded,
  };
};

const linkLocal = (mediaId: string) =>
  query(
    `insert into app_public.project_medias (project_id, media_id, plugin_id)
     values ($1, $2, $3)`,
    [localProjectId, mediaId, PLUGIN_ID],
  );
const localLinks = async () =>
  (
    await query(
      `select media_id from app_public.project_medias where project_id = $1`,
      [localProjectId],
    )
  ).map((r) => r.media_id);
const cloudLink = (mediaId: string) => ({
  projectId: cloudProjectId,
  mediaId,
  pluginId: PLUGIN_ID,
});
const dependsOn = (parentMediaId: string, childMediaId: string) =>
  query(
    `insert into app_public.media_dependencies (parent_media_id, child_media_id)
     values ($1, $2)`,
    [parentMediaId, childMediaId],
  );

beforeAll(async () => {
  pool = poolFromUrl(TEST_DATABASE_URL);
  fake = await startFakeCloud([]);
  const file = await import("../../backend-shared/src/media/file");
  expect(file.UPLOADS_PATH).toBe(uploads);
  handler = new file.mediaDataHandler.mediaHandler(withPgClient);
  ({ syncMedia } = await import(
    "../../backend-shared/src/cloud/sync/media/sync"
  ));
});

afterAll(async () => {
  await fake.close();
  fs.rmSync(uploads, { recursive: true, force: true });
  if (previousUploadsPath === undefined) delete process.env.UPLOADS_PATH;
  else process.env.UPLOADS_PATH = previousUploadsPath;
});

beforeEach(async () => {
  resetFakeCloud(fake);
  [{ id: orgId }] = await query(
    `insert into app_public.organizations (slug, name)
     values ($1, 'Media sync') returning id`,
    [`${ORG_PREFIX}-${Date.now()}`],
  );
  [connection] = await query(
    `insert into app_public.cloud_connections
       (organization_id, host, session_cookie, session_cookie_expiry, target_organization_slug)
     values ($1, $2, 'session=test', now() + interval '1 day', 'cloudorg')
     returning id, host, session_cookie, organization_id,
       target_organization_slug, creator_user_id`,
    [orgId, fake.url],
  );
  // One project on both sides, as project sync leaves it.
  cloudProjectId = randomUUID();
  [{ id: localProjectId }] = await query(
    `insert into app_public.projects
       (organization_id, slug, name, cloud_project_id, cloud_connection_id)
     values ($1, 'p', 'Project', $2, $3) returning id`,
    [orgId, cloudProjectId, connection.id],
  );
  fake.projects.push({
    id: cloudProjectId,
    createdAt: fake.now(),
    updatedAt: fake.now(),
    value: { name: "Project", targetDate: null, category: null, tags: [] },
  });
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

/** Sync, and expect nothing to move in either direction. */
const expectQuietSync = async () => {
  const before = {
    uploads: [...fake.uploadedBytes.values()].reduce((a, b) => a + b, 0),
    pushes: fake.mediaPushes.length,
    deletes: fake.mediaDeletes.length,
  };
  const result = await sync();
  expect(result).toEqual({
    pulled: 0,
    pushed: 0,
    transferFailed: 0,
    deletedLocally: 0,
    deletedOnCloud: 0,
    keptInUse: 0,
    linksAdded: 0,
    linksRemoved: 0,
  });
  expect([...fake.uploadedBytes.values()].reduce((a, b) => a + b, 0)).toBe(
    before.uploads,
  );
  expect(fake.mediaPushes.length).toBe(before.pushes);
  expect(fake.mediaDeletes.length).toBe(before.deletes);
};

describe("uploads only on the cloud", () => {
  it("are downloaded under the same id, across pages", async () => {
    const media = ["one", "two", "three"].map((c) => createOnCloud(c));

    expect(await sync()).toMatchObject({ pulled: 3, pushed: 0 });

    for (const [i, m] of media.entries()) {
      expect(await localFile(m.mediaName)).toEqual({
        content: ["one", "two", "three"][i],
        userUploaded: true,
      });
    }
    await expectQuietSync();
  });

  it("comes with its metadata", async () => {
    const video = createOnCloud("video", { extension: "mp4" });
    const thumbnail = createOnCloud("thumb", { userUploaded: false });
    fake.mediaMetadata.dependencies.push({
      parentMediaId: video.id,
      childMediaId: thumbnail.id,
    });
    fake.mediaMetadata.imageMetadata.push({
      imageMediaId: thumbnail.id,
      width: 640,
      height: 360,
    });
    fake.mediaMetadata.videoMetadata.push({
      videoMediaId: video.id,
      hlsMediaId: null,
      thumbnailMediaId: thumbnail.id,
      mp4MediaId: null,
      duration: "12.50",
      transcodeStatus: "completed",
    });

    await sync();

    expect(
      await query(
        `select child_media_id from app_public.media_dependencies
         where parent_media_id = $1`,
        [video.id],
      ),
    ).toEqual([{ child_media_id: thumbnail.id }]);
    expect(
      await query(
        `select thumbnail_media_id, duration::text, transcode_status
         from app_public.media_video_metadata where video_media_id = $1`,
        [video.id],
      ),
    ).toEqual([
      {
        thumbnail_media_id: thumbnail.id,
        duration: "12.50",
        transcode_status: "completed",
      },
    ]);
    await expectQuietSync();
  });

  it("is retried next sync if its download fails", async () => {
    const media = createOnCloud("flaky");
    fake.mediaMetadata.imageMetadata.push({
      imageMediaId: media.id,
      width: 1,
      height: 1,
    });
    fake.failTransfers.add(media.mediaName);

    expect(await sync()).toMatchObject({ pulled: 0, transferFailed: 1 });
    expect(await localFile(media.mediaName)).toBeNull();

    fake.failTransfers.clear();
    expect(await sync()).toMatchObject({ pulled: 1 });
    expect((await localFile(media.mediaName))!.content).toBe("flaky");
  });
});

describe("uploads only here", () => {
  it("are uploaded under the same id, as they are here", async () => {
    const original = await createLocal("pdf", { extension: "pdf" });
    const page = await createLocal("page", { userUploaded: false });
    await dependsOn(original.id, page.id);

    expect(await sync()).toMatchObject({ pushed: 2, pulled: 0 });

    expect(fake.files.get(original.mediaName)?.toString()).toBe("pdf");
    expect(fake.files.get(page.mediaName)?.toString()).toBe("page");
    expect(fake.uploadHeaders.get(page.mediaName)).toMatchObject({
      "organization-id": expect.any(String),
      "custom-media-id": mediaIdFromUUID(page.id),
      "cloud-sync": "1",
      "cloud-sync-user-uploaded": "0",
      cookie: "session=test",
    });
    expect(fake.media.find((m) => m.id === original.id)).toMatchObject({
      isUserUploaded: true,
      originalName: "pdf.pdf",
    });
    expect(fake.mediaMetadata.dependencies).toEqual([
      { parentMediaId: original.id, childMediaId: page.id },
    ]);
    await expectQuietSync();
  });

  it("sends only the rest of an interrupted upload", async () => {
    const media = await createLocal("abcdefghij");
    fake.failTransfers.add(media.mediaName);
    expect(await sync()).toMatchObject({ transferFailed: 1, pushed: 0 });
    // Say the first four bytes made it before the connection dropped.
    fake.partialUploads.set(media.mediaName, Buffer.from("abcd"));
    fake.failTransfers.clear();

    expect(await sync()).toMatchObject({ pushed: 1 });

    expect(fake.uploadedBytes.get(media.mediaName)).toBe(6);
    expect(fake.files.get(media.mediaName)?.toString()).toBe("abcdefghij");
  });

  it("is not uploaded again when the cloud already has it", async () => {
    const media = await createLocal("done");
    // Uploaded, but the sync that did it never recorded so.
    fake.files.set(media.mediaName, Buffer.from("done"));

    await sync();

    expect(fake.uploadedBytes.get(media.mediaName)).toBeUndefined();
  });

  it("is not uploaded while incomplete", async () => {
    const media = await createLocal("partial");
    await query(
      "update app_public.medias set is_complete = false where id = $1",
      [media.id],
    );

    expect(await sync()).toMatchObject({ pushed: 0 });
    expect(fake.files.has(media.mediaName)).toBe(false);
  });
});

describe("media deleted on the cloud", () => {
  it("is deleted here if unused", async () => {
    const media = await createLocal("gone");
    await sync();
    fake.media = [];
    fake.files.clear();

    expect(await sync()).toMatchObject({
      deletedLocally: 1,
      pushed: 0,
      transferFailed: 0,
    });
    expect(await localFile(media.mediaName)).toBeNull();
    await expectQuietSync();
  });

  it("is uploaded again if a project here uses it", async () => {
    const media = await createLocal("kept");
    await linkLocal(media.id);
    await sync();
    expect(fake.mediaLinks).toEqual([cloudLink(media.id)]);
    // Deleted from the cloud's library: its links went with it.
    fake.media = [];
    fake.files.clear();
    fake.mediaLinks = [];

    expect(await sync()).toMatchObject({
      keptInUse: 1,
      pushed: 1,
      deletedLocally: 0,
      linksRemoved: 0,
    });
    expect(fake.files.get(media.mediaName)?.toString()).toBe("kept");
    expect(fake.mediaLinks).toEqual([cloudLink(media.id)]);
    expect(await localLinks()).toEqual([media.id]);
    await expectQuietSync();
  });

  it("gets its use back once a failed restore succeeds", async () => {
    const media = await createLocal("kept");
    await linkLocal(media.id);
    await sync();
    fake.media = [];
    fake.files.clear();
    fake.mediaLinks = [];
    fake.failTransfers.add(media.mediaName);

    expect(await sync()).toMatchObject({ keptInUse: 1, transferFailed: 1 });
    fake.failTransfers.clear();
    await sync();

    expect(fake.files.get(media.mediaName)?.toString()).toBe("kept");
    expect(fake.mediaLinks).toEqual([cloudLink(media.id)]);
    expect(await localLinks()).toEqual([media.id]);
  });

  it("is uploaded again with what was derived from it, if that is in use here", async () => {
    // A PDF in the library whose pages are on a slide here.
    const pdf = await createLocal("pdf", { extension: "pdf" });
    const page = await createLocal("page", { userUploaded: false });
    await dependsOn(pdf.id, page.id);
    await linkLocal(page.id);
    await sync();
    expect(fake.mediaLinks).toEqual([cloudLink(page.id)]);
    // Deleted from the cloud's library: its pages and their links went too.
    fake.media = [];
    fake.files.clear();
    fake.mediaLinks = [];
    fake.mediaMetadata.dependencies = [];

    expect(await sync()).toMatchObject({
      keptInUse: 1,
      pushed: 2,
      deletedLocally: 0,
      linksRemoved: 0,
    });
    expect(fake.files.get(pdf.mediaName)?.toString()).toBe("pdf");
    expect(fake.files.get(page.mediaName)?.toString()).toBe("page");
    expect(fake.mediaLinks).toEqual([cloudLink(page.id)]);
    expect(fake.mediaMetadata.dependencies).toEqual([
      { parentMediaId: pdf.id, childMediaId: page.id },
    ]);
    await expectQuietSync();
  });
});

describe("plugin media", () => {
  it("are copied only where a link needs them", async () => {
    const linkedThere = createOnCloud("linked there", { userUploaded: false });
    const orphanThere = createOnCloud("orphan there", { userUploaded: false });
    fake.mediaLinks.push(cloudLink(linkedThere.id));
    const linkedHere = await createLocal("linked here", {
      userUploaded: false,
    });
    const orphanHere = await createLocal("orphan here", {
      userUploaded: false,
    });
    await linkLocal(linkedHere.id);

    expect(await sync()).toMatchObject({ pulled: 1, pushed: 1, linksAdded: 2 });

    expect(await localFile(linkedThere.mediaName)).not.toBeNull();
    expect(await localFile(orphanThere.mediaName)).toBeNull();
    expect(fake.files.has(linkedHere.mediaName)).toBe(true);
    expect(fake.files.has(orphanHere.mediaName)).toBe(false);
    await expectQuietSync();
  });

  it("get their link once a failed download succeeds", async () => {
    const media = createOnCloud("page", { userUploaded: false });
    fake.mediaLinks.push(cloudLink(media.id));
    fake.failTransfers.add(media.mediaName);

    expect(await sync()).toMatchObject({ transferFailed: 1, linksAdded: 0 });
    expect(await localLinks()).toEqual([]);

    fake.failTransfers.clear();
    expect(await sync()).toMatchObject({ pulled: 1, linksAdded: 1 });
    expect(await localLinks()).toEqual([media.id]);
  });

  it("are not copied for a project not on both sides", async () => {
    const media = createOnCloud("p", { userUploaded: false });
    fake.mediaLinks.push(cloudLink(media.id));

    expect(await sync([])).toMatchObject({ pulled: 0 });
    expect(await localFile(media.mediaName)).toBeNull();
  });

  it("follow what they were derived from, also when made later", async () => {
    const video = await createLocal("video", { extension: "mp4" });
    await sync();
    // Transcoded here after the video was synced.
    const rendition = await createLocal("hls", {
      extension: "m3u8",
      userUploaded: false,
    });
    await dependsOn(video.id, rendition.id);

    expect(await sync()).toMatchObject({ pushed: 1 });

    expect(fake.files.get(rendition.mediaName)?.toString()).toBe("hls");
    expect(fake.mediaMetadata.dependencies).toEqual([
      { parentMediaId: video.id, childMediaId: rendition.id },
    ]);
    await expectQuietSync();
  });

  it("are left to this side's cleanup when the cloud stops using them", async () => {
    const media = await createLocal("page", { userUploaded: false });
    await linkLocal(media.id);
    await sync();
    // Removed from the project on the cloud, then cleaned up there.
    fake.mediaLinks = [];
    fake.media = [];
    fake.files.clear();

    expect(await sync()).toMatchObject({
      linksRemoved: 1,
      deletedLocally: 0,
      keptInUse: 0,
      pushed: 0,
    });
    expect(await localLinks()).toEqual([]);
    // The cleanup trigger queued its deletion here, as for any unlink.
    expect(
      await query(
        `select 1 from graphile_worker.jobs j
         join graphile_worker._private_jobs p on p.id = j.id
         where j.task_identifier = 'medias__delete' and p.payload ->> 'id' = $1`,
        [media.id],
      ),
    ).toHaveLength(1);
    expect(fake.media).toEqual([]);
  });

  it("are never deleted by sync", async () => {
    const media = createOnCloud("orphan", { userUploaded: false });
    fake.mediaLinks.push(cloudLink(media.id));
    await sync();
    await query("delete from app_public.project_medias where project_id = $1", [
      localProjectId,
    ]);
    fake.mediaLinks = [];
    fake.media = [];

    expect(await sync()).toMatchObject({
      deletedLocally: 0,
      deletedOnCloud: 0,
    });
    expect(await localFile(media.mediaName)).not.toBeNull();
    expect(fake.mediaDeletes).toEqual([]);
  });
});

describe("media deleted here", () => {
  it("is deleted on the cloud if unused there", async () => {
    const media = createOnCloud("gone");
    await sync();
    await handler.deleteMedia(media.mediaName);

    expect(await sync()).toMatchObject({ deletedOnCloud: 1, pulled: 0 });
    expect(fake.media).toEqual([]);
    await expectQuietSync();
  });

  it("is downloaded again if a project on the cloud uses it", async () => {
    const media = createOnCloud("kept");
    fake.mediaLinks.push(cloudLink(media.id));
    await sync();
    expect(await localLinks()).toEqual([media.id]);
    // Deleted from the library here: its links went with it.
    await handler.deleteMedia(media.mediaName);

    expect(await sync()).toMatchObject({
      keptInUse: 1,
      pulled: 1,
      deletedOnCloud: 0,
      linksRemoved: 0,
    });
    expect((await localFile(media.mediaName))!.content).toBe("kept");
    expect(await localLinks()).toEqual([media.id]);
    expect(fake.mediaLinks).toEqual([cloudLink(media.id)]);
    await expectQuietSync();
  });

  it("is downloaded again with what was derived from it, if that is in use on the cloud", async () => {
    const pdf = createOnCloud("pdf", { extension: "pdf" });
    const page = createOnCloud("page", { userUploaded: false });
    fake.mediaMetadata.dependencies.push({
      parentMediaId: pdf.id,
      childMediaId: page.id,
    });
    fake.mediaLinks.push(cloudLink(page.id));
    await sync();
    expect(await localLinks()).toEqual([page.id]);
    // Deleted from the library here: its pages and their links went too.
    await handler.deleteMedia(pdf.mediaName);

    expect(await sync()).toMatchObject({
      keptInUse: 1,
      pulled: 2,
      deletedOnCloud: 0,
      linksRemoved: 0,
    });
    expect((await localFile(pdf.mediaName))!.content).toBe("pdf");
    expect((await localFile(page.mediaName))!.content).toBe("page");
    expect(await localLinks()).toEqual([page.id]);
    expect(fake.mediaLinks).toEqual([cloudLink(page.id)]);
    await expectQuietSync();
  });

  it("is downloaded again if the cloud put it to use meanwhile", async () => {
    const media = createOnCloud("raced");
    await sync();
    await handler.deleteMedia(media.mediaName);
    fake.refuseDeletes.add(media.id);

    expect(await sync()).toMatchObject({ deletedOnCloud: 0 });
    expect(fake.media).toHaveLength(1);

    fake.refuseDeletes.clear();
    expect(await sync()).toMatchObject({ pulled: 1 });
    expect(await localFile(media.mediaName)).not.toBeNull();
  });

  it("is forgotten if the cloud deleted it too", async () => {
    const media = createOnCloud("both");
    await sync();
    await handler.deleteMedia(media.mediaName);
    fake.media = [];

    expect(await sync()).toMatchObject({
      deletedOnCloud: 0,
      deletedLocally: 0,
      pulled: 0,
    });
    expect(fake.mediaDeletes).toEqual([]);
    await expectQuietSync();
  });
});

describe("links", () => {
  it("are added on each side, by each side's project id", async () => {
    const here = await createLocal("here");
    const there = createOnCloud("there");
    await linkLocal(here.id);
    fake.mediaLinks.push(cloudLink(there.id));

    expect(await sync()).toMatchObject({ linksAdded: 2 });

    expect((await localLinks()).sort()).toEqual([here.id, there.id].sort());
    expect(fake.mediaLinks).toEqual(
      expect.arrayContaining([cloudLink(here.id), cloudLink(there.id)]),
    );
    await expectQuietSync();
  });

  it("found on both sides at once are recorded, so a later removal syncs", async () => {
    const media = createOnCloud("m");
    await sync();
    // Each side links it before the next sync.
    await linkLocal(media.id);
    fake.mediaLinks.push(cloudLink(media.id));
    expect(await sync()).toMatchObject({ linksAdded: 0 });

    fake.mediaLinks = [];
    expect(await sync()).toMatchObject({ linksRemoved: 1 });
    expect(await localLinks()).toEqual([]);
  });

  it("are removed on each side", async () => {
    const a = createOnCloud("a");
    const b = createOnCloud("b");
    fake.mediaLinks.push(cloudLink(a.id), cloudLink(b.id));
    await sync();

    fake.mediaLinks = fake.mediaLinks.filter((l) => l.mediaId !== a.id);
    await query(
      `delete from app_public.project_medias where project_id = $1 and media_id = $2`,
      [localProjectId, b.id],
    );

    expect(await sync()).toMatchObject({ linksRemoved: 2 });
    expect(await localLinks()).toEqual([]);
    expect(fake.mediaLinks).toEqual([]);
  });

  it("are forgotten once gone from both sides", async () => {
    const media = createOnCloud("m");
    fake.mediaLinks.push(cloudLink(media.id));
    await sync();
    fake.mediaLinks = [];
    await query("delete from app_public.project_medias where project_id = $1", [
      localProjectId,
    ]);

    expect(await sync()).toMatchObject({ linksRemoved: 0, linksAdded: 0 });
    expect(
      await query(
        `select 1 from app_private.cloud_sync_rows
         where cloud_connection_id = $1 and entity = 'app_public.project_medias'`,
        [connection.id],
      ),
    ).toEqual([]);
  });

  it("are left alone for projects not on both sides", async () => {
    const media = createOnCloud("m");
    fake.mediaLinks.push(cloudLink(media.id));
    await sync();

    // The project was deleted here, and its deletion is not on the cloud yet.
    await query("delete from app_public.projects where id = $1", [
      localProjectId,
    ]);
    expect(await sync([])).toMatchObject({ linksRemoved: 0 });

    expect(fake.mediaLinks).toEqual([cloudLink(media.id)]);
  });
});

describe("large first syncs", () => {
  it("push metadata and links over the cloud's request limit, in parts", async () => {
    const image = await createLocal("image");
    const processed = await createLocal("small", { userUploaded: false });
    await dependsOn(image.id, processed.id);
    await query(
      `insert into app_public.media_image_sizes
         (image_media_id, processed_media_id, width, file_type)
       select $1, $2, w, 'jpg' from generate_series(1, 1500) w`,
      [image.id, processed.id],
    );
    await query(
      `insert into app_public.project_medias (project_id, media_id, plugin_id)
       select $1, $2, gen_random_uuid() from generate_series(1, 1500)`,
      [localProjectId, image.id],
    );

    expect(await sync()).toMatchObject({ pushed: 2, linksAdded: 1500 });

    expect(fake.mediaMetadata.imageSizes).toHaveLength(1500);
    expect(fake.mediaLinks).toHaveLength(1500);
    await expectQuietSync();
  });
});

describe("metadata", () => {
  it("keeps a completed transcode over one in progress, either way", async () => {
    const here = await createLocal("v1", { extension: "mp4" });
    await query(
      `insert into app_public.media_video_metadata (video_media_id, transcode_status)
       values ($1, 'completed')`,
      [here.id],
    );
    await sync();
    expect(fake.mediaMetadata.videoMetadata[0]).toMatchObject({
      transcodeStatus: "completed",
    });

    const there = createOnCloud("v2", { extension: "mp4" });
    fake.mediaMetadata.videoMetadata.push({
      videoMediaId: there.id,
      hlsMediaId: null,
      thumbnailMediaId: null,
      mp4MediaId: null,
      duration: null,
      transcodeStatus: "pending",
    });
    await sync();
    await query(
      `update app_public.media_video_metadata set transcode_status = 'completed'
       where video_media_id = $1`,
      [there.id],
    );

    await sync();

    expect(
      fake.mediaMetadata.videoMetadata.find((v) => v.videoMediaId === there.id),
    ).toMatchObject({ transcodeStatus: "completed" });
    expect(
      await query(
        `select transcode_status from app_public.media_video_metadata
         where video_media_id = $1`,
        [there.id],
      ),
    ).toEqual([{ transcode_status: "completed" }]);
  });
});

describe("audio metadata", () => {
  const audioRow = (audioMediaId: string, playbackMediaId: string) => ({
    audioMediaId,
    playbackMediaId,
    coverMediaId: null,
    duration: "4.05",
    title: "A Song",
    artist: "An Artist",
    album: null,
    normalizeLoudness: true,
    transcodeStatus: "completed",
  });

  it("carries the processed audio both ways", async () => {
    const here = await createLocal("a1", { extension: "mp3" });
    const herePlayback = await createLocal("a1-playback", {
      extension: "m4a",
      userUploaded: false,
    });
    await query(
      `insert into app_public.media_dependencies (parent_media_id, child_media_id)
       values ($1, $2)`,
      [here.id, herePlayback.id],
    );
    await query(
      `insert into app_public.media_audio_metadata
         (audio_media_id, playback_media_id, duration, title, artist, transcode_status)
       values ($1, $2, 4.05, 'A Song', 'An Artist', 'completed')`,
      [here.id, herePlayback.id],
    );
    await sync();
    expect(
      fake.mediaMetadata.audioMetadata?.find((r) => r.audioMediaId === here.id),
    ).toMatchObject(audioRow(here.id, herePlayback.id));

    const there = createOnCloud("a2", { extension: "mp3" });
    const therePlayback = createOnCloud("a2-playback", {
      extension: "m4a",
      userUploaded: false,
    });
    fake.mediaMetadata.dependencies.push({
      parentMediaId: there.id,
      childMediaId: therePlayback.id,
    });
    fake.mediaMetadata.audioMetadata!.push(
      audioRow(there.id, therePlayback.id),
    );
    await sync();

    expect(
      await query(
        `select playback_media_id, title, transcode_status
         from app_public.media_audio_metadata where audio_media_id = $1`,
        [there.id],
      ),
    ).toEqual([
      {
        playback_media_id: therePlayback.id,
        title: "A Song",
        transcode_status: "completed",
      },
    ]);
  });

  it("syncs with an instance from before audio processing", async () => {
    delete fake.mediaMetadata.audioMetadata;
    const here = await createLocal("a3", { extension: "mp3" });
    await query(
      `insert into app_public.media_audio_metadata (audio_media_id, transcode_status)
       values ($1, 'completed')`,
      [here.id],
    );
    createOnCloud("a4", { extension: "mp3" });

    await sync();
    await expectQuietSync();
    expect(fake.mediaMetadata.audioMetadata).toBeUndefined();
  });
});

describe("when the cloud cannot answer", () => {
  it("changes nothing if the organization is not found", async () => {
    const media = await createLocal("safe");
    await sync();
    fake.orgMissing = true;

    await expect(sync()).rejects.toThrow("Organization not found");

    expect(await localFile(media.mediaName)).not.toBeNull();
  });
});
