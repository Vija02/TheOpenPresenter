import { runPluginMigrations } from "@repo/base-plugin/server";
import path from "path";
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

import {
  TEST_DATABASE_URL,
  deleteTestUsers,
  poolFromUrl,
} from "../../__tests__/helpers";
import { introspectCloudSyncTables } from "../../backend-shared/src/cloud/sync/pluginTables/introspection";
import { syncPluginTables } from "../../backend-shared/src/cloud/sync/pluginTables/sync";
import { WithPgClient } from "../../backend-shared/src/types";
import {
  CLOUD_ORG_ID,
  FakeCloud,
  resetFakeCloud,
  startFakeCloud,
} from "./helpers/fakeCloud";

/**
 * The local half of plugin table sync, against a real database and a fake
 * cloud. The cloud's own SQL is tested in cloudPluginTableServe.test.ts.
 */

const SONGS = "plugin_lyrics_presenter.saved_song";
const SETLIST_SOURCES = "plugin_lyrics_presenter.setlist_source";
const BIBLE_PREFERENCES = "plugin_bible.bible_preference";
const RECENT_SONGS = "plugin_lyrics_presenter.recent_song";
const CATEGORIES = "app_public.categories";
const ORG_PREFIX = "testpluginsync";

type Row = Record<string, unknown>;

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
};

const withPgClient: WithPgClient = async (callback) => {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
};

const sync = (forceResync = false) =>
  syncPluginTables(withPgClient, connection, { forceResync });

const query = async (text: string, params: unknown[] = []) =>
  (await pool.query(text, params)).rows;

const SONG_ID = "5a1e0000-0000-4000-8000-000000000001";
const CLOUD_USER_ID = "c1000000-0000-4000-8000-000000000001";

/** A `saved_song` row as the cloud's `to_jsonb` would serialize it. */
const cloudSong = (title: string, updatedAt: string): Row => ({
  id: SONG_ID,
  organization_id: CLOUD_ORG_ID,
  created_by_user_id: CLOUD_USER_ID,
  title,
  author: null,
  album: null,
  content: `${title} lyrics`,
  source: "manual",
  external_id: null,
  song: { title },
  video_backgrounds: [],
  created_at: "2026-01-01T00:00:00+00:00",
  updated_at: updatedAt,
});

const localSongs = () =>
  query(
    `select id, title, created_by_user_id from ${SONGS}
     where organization_id = $1 order by title`,
    [orgId],
  );

beforeAll(async () => {
  pool = poolFromUrl(TEST_DATABASE_URL);
  // The test database only has core migrations; plugins migrate at boot.
  const plugins = path.join(__dirname, "../../../plugins");
  await runPluginMigrations(pool, [
    {
      pluginName: "lyrics-presenter",
      migrationsPath: path.join(plugins, "lyrics-presenter/migrations"),
    },
    {
      pluginName: "bible",
      migrationsPath: path.join(plugins, "bible/migrations"),
    },
  ]);
  const { tables } = await introspectCloudSyncTables(pool);
  fake = await startFakeCloud(tables);
});

afterAll(async () => {
  await fake.close();
});

beforeEach(async () => {
  resetFakeCloud(fake);

  // Sync commits its own transactions, so tests write real rows and clean up
  // by org instead of rolling back.
  [{ id: orgId }] = await query(
    `insert into app_public.organizations (slug, name)
     values ($1, 'Plugin sync') returning id`,
    [`${ORG_PREFIX}-${Date.now()}`],
  );
  // New orgs get default categories; start from none so each test stages
  // exactly what it needs.
  await query(`delete from ${CATEGORIES} where organization_id = $1`, [orgId]);
  [{ id: userId }] = await query(
    `select id from app_private.really_create_user(
       username := 'testuser_pluginsync', email := 'testuser_pluginsync@example.com',
       email_is_verified := true, name := 'Plugin Sync', avatar_url := null,
       password := 'TestUserPassword')`,
  );
  [connection] = await query(
    `insert into app_public.cloud_connections
       (organization_id, host, session_cookie, session_cookie_expiry, target_organization_slug)
     values ($1, $2, 'session=test', now() + interval '1 day', 'cloudorg')
     returning id, host, session_cookie, organization_id, target_organization_slug`,
    [orgId, fake.url],
  );
});

afterEach(async () => {
  // Cascades to plugin rows, the connection and its sync state.
  await query(`delete from app_public.organizations where slug like $1`, [
    `${ORG_PREFIX}-%`,
  ]);
  await deleteTestUsers();
});

describe("syncPluginTables", () => {
  it("pulls a new cloud row under its cloud id, into the local org", async () => {
    fake.tables.set(SONGS, [
      cloudSong("Amazing Grace", "2026-01-01T00:00:00.000001+00:00"),
    ]);

    const result = await sync();

    expect(result).toMatchObject({ pulled: 1, conflicts: 0, failedTables: 0 });
    // The cloud's user means nothing here, so it is cleared.
    expect(await localSongs()).toEqual([
      { id: SONG_ID, title: "Amazing Grace", created_by_user_id: null },
    ]);
  });

  it("downloads nothing when the cloud has not changed", async () => {
    fake.tables.set(SONGS, [
      cloudSong("Amazing Grace", "2026-01-01T00:00:00.000001+00:00"),
    ]);
    await sync();
    fake.downloaded.clear();

    const result = await sync();

    expect(result.pulled).toBe(0);
    expect(fake.downloaded.get(SONGS)).toBeUndefined();
  });

  it("applies an edit made only on the cloud", async () => {
    fake.tables.set(SONGS, [
      cloudSong("Amazing Grace", "2026-01-01T00:00:00+00:00"),
    ]);
    await sync();
    fake.tables.set(SONGS, [
      cloudSong("Amazing Grace (Live)", "2026-01-02T00:00:00+00:00"),
    ]);

    const result = await sync();

    expect(result).toMatchObject({ pulled: 1, conflicts: 0 });
    expect((await localSongs()).map((s) => s.title)).toEqual([
      "Amazing Grace (Live)",
    ]);
  });

  it("pushes an edit made only locally, based on the cloud row it saw", async () => {
    fake.tables.set(SONGS, [
      cloudSong("Amazing Grace", "2026-01-01T00:00:00+00:00"),
    ]);
    await sync();
    await query(`update ${SONGS} set title = 'Edited here' where id = $1`, [
      SONG_ID,
    ]);

    const result = await sync();

    expect(result).toMatchObject({ pulled: 0, pushed: 1, pushRejected: 0 });
    expect(fake.pushed.get(SONGS)).toMatchObject([
      {
        key: { id: SONG_ID },
        expectedUpdatedAt: "2026-01-01T00:00:00+00:00",
        row: { title: "Edited here" },
      },
    ]);
    expect(fake.tables.get(SONGS)![0]).toMatchObject({ title: "Edited here" });
    expect((await localSongs()).map((s) => s.title)).toEqual(["Edited here"]);
  });

  it("keeps the local side of a two-sided edit as a conflicted copy", async () => {
    fake.tables.set(SONGS, [
      cloudSong("Amazing Grace", "2026-01-01T00:00:00+00:00"),
    ]);
    await sync();
    await query(`update ${SONGS} set title = 'Edited here' where id = $1`, [
      SONG_ID,
    ]);
    fake.tables.set(SONGS, [
      cloudSong("Edited on cloud", "2026-01-02T00:00:00+00:00"),
    ]);

    const result = await sync();

    expect(result).toMatchObject({ pulled: 1, conflicts: 1 });
    const songs = await localSongs();
    expect(songs.map((s) => s.title)).toEqual([
      "Edited here (conflicted copy)",
      "Edited on cloud",
    ]);
    // The cloud's version keeps the id, so documents linked to it follow.
    expect(songs.find((s) => s.title === "Edited on cloud")!.id).toBe(SONG_ID);
    // The kept copy is new here, so it goes up in the same sync.
    expect(result.pushed).toBe(1);
    expect(
      fake.tables
        .get(SONGS)!
        .map((r) => r.title)
        .sort(),
    ).toEqual(["Edited here (conflicted copy)", "Edited on cloud"]);
  });

  it("applies a cloud delete to a row untouched here", async () => {
    fake.tables.set(SONGS, [
      cloudSong("Amazing Grace", "2026-01-01T00:00:00+00:00"),
    ]);
    await sync();
    fake.tables.set(SONGS, []);

    const result = await sync();

    expect(result).toMatchObject({ deletedLocally: 1, pushed: 0 });
    expect(await localSongs()).toEqual([]);
  });

  it("matches composite keys and keeps local user attribution on overwrite", async () => {
    await query(
      `insert into ${SETLIST_SOURCES} (organization_id, source, enabled, enabled_by_user_id)
       values ($1, 'myworshiplist', true, $2)`,
      [orgId, userId],
    );
    const cloudSource = (enabled: boolean, updatedAt: string) => ({
      organization_id: CLOUD_ORG_ID,
      source: "myworshiplist",
      enabled,
      enabled_by_user_id: CLOUD_USER_ID,
      created_at: "2026-01-01T00:00:00+00:00",
      updated_at: updatedAt,
    });
    // Same content on both sides: recorded as synced, nothing written.
    fake.tables.set(SETLIST_SOURCES, [
      cloudSource(true, "2026-01-01T00:00:00+00:00"),
    ]);
    await sync();
    fake.tables.set(SETLIST_SOURCES, [
      cloudSource(false, "2026-01-02T00:00:00+00:00"),
    ]);

    const result = await sync();

    expect(result).toMatchObject({ pulled: 1, conflicts: 0 });
    expect(
      await query(
        `select source, enabled, enabled_by_user_id from ${SETLIST_SOURCES}
         where organization_id = $1`,
        [orgId],
      ),
    ).toEqual([
      { source: "myworshiplist", enabled: false, enabled_by_user_id: userId },
    ]);
  });

  it("lets the cloud win for a one-row-per-org table", async () => {
    await query(
      `insert into ${BIBLE_PREFERENCES} (organization_id, languages) values ($1, '["en"]')`,
      [orgId],
    );
    fake.tables.set(BIBLE_PREFERENCES, [
      {
        // A different id: the org, not the id, identifies this row.
        id: "b1000000-0000-4000-8000-000000000001",
        organization_id: CLOUD_ORG_ID,
        languages: ["id"],
        translation_ids: [],
        primary_translation_id: null,
        favorite_translation_ids: [],
        created_at: "2026-01-01T00:00:00+00:00",
        updated_at: "2026-01-01T00:00:00+00:00",
      },
    ]);

    const result = await sync();

    expect(result).toMatchObject({ pulled: 1, conflicts: 1 });
    expect(
      await query(
        `select languages from ${BIBLE_PREFERENCES} where organization_id = $1`,
        [orgId],
      ),
    ).toEqual([{ languages: ["id"] }]);
  });

  it("downloads everything again on a forced resync", async () => {
    fake.tables.set(SONGS, [
      cloudSong("Amazing Grace", "2026-01-01T00:00:00+00:00"),
    ]);
    await sync();
    fake.downloaded.clear();

    await sync(true);

    expect(fake.downloaded.get(SONGS)).toEqual([{ id: SONG_ID }]);
  });

  it("skips quietly when the cloud predates plugin sync", async () => {
    fake.unsupported = true;

    const result = await sync();

    expect(result).toMatchObject({ pulled: 0, failedTables: 0 });
  });

  describe("recent_song", () => {
    const cloudUse = (id: string, usedAt: string): Row => ({
      id,
      organization_id: CLOUD_ORG_ID,
      saved_song_id: SONG_ID,
      created_at: usedAt,
      updated_at: usedAt,
    });
    const localUses = () =>
      query(
        `select id, saved_song_id, created_at from ${RECENT_SONGS}
         where organization_id = $1`,
        [orgId],
      );

    it("pulls uses after their song, keeping when they happened", async () => {
      fake.tables.set(SONGS, [
        cloudSong("Amazing Grace", "2026-01-01T00:00:00+00:00"),
      ]);
      fake.tables.set(RECENT_SONGS, [
        cloudUse(
          "0e000000-0000-4000-8000-000000000001",
          "2026-01-03T09:30:00+00:00",
        ),
      ]);

      await sync();

      // Same sync as the song: the song table is pulled first.
      expect(await localUses()).toEqual([
        {
          id: "0e000000-0000-4000-8000-000000000001",
          saved_song_id: SONG_ID,
          created_at: new Date("2026-01-03T09:30:00Z"),
        },
      ]);
    });

    it("skips a use whose song is not here, without failing the rest", async () => {
      fake.tables.set(SONGS, [
        cloudSong("Amazing Grace", "2026-01-01T00:00:00+00:00"),
      ]);
      await sync();
      // Deleted here: the cloud still has uses pointing at it.
      await query(`delete from ${SONGS} where id = $1`, [SONG_ID]);
      fake.tables.set(SONGS, []);
      fake.tables.set(RECENT_SONGS, [
        cloudUse(
          "0e000000-0000-4000-8000-000000000002",
          "2026-01-03T09:30:00+00:00",
        ),
      ]);

      const result = await sync();

      expect(result.failedTables).toBe(0);
      expect(await localUses()).toEqual([]);
    });
  });

  describe("two-way", () => {
    const insertLocalSong = (id: string, title: string) =>
      query(
        `insert into ${SONGS} (id, organization_id, created_by_user_id, title, song)
         values ($1, $2, $3, $4, $5)`,
        [id, orgId, userId, title, { title }],
      );
    const LOCAL_SONG_ID = "10ca1000-0000-4000-8000-000000000001";

    it("pushes a row created here once, then leaves it", async () => {
      await insertLocalSong(LOCAL_SONG_ID, "Written offline");

      const result = await sync();

      expect(result).toMatchObject({ pushed: 1, pushRejected: 0 });
      expect(fake.pushed.get(SONGS)).toMatchObject([
        { key: { id: LOCAL_SONG_ID }, expectedUpdatedAt: null },
      ]);
      // Our id becomes the cloud's id, so documents linked to it still work.
      expect(fake.tables.get(SONGS)).toMatchObject([
        { id: LOCAL_SONG_ID, title: "Written offline" },
      ]);

      fake.pushed.clear();
      fake.downloaded.clear();
      const again = await sync();

      expect(again).toMatchObject({ pulled: 0, pushed: 0 });
      expect(fake.pushed.get(SONGS)).toBeUndefined();
      expect(fake.downloaded.get(SONGS)).toBeUndefined();
    });

    it("pushes more than the cloud reads per request, in parts", async () => {
      // About 600kb of lyrics, over the cloud's 100kb request limit.
      await query(
        `insert into ${SONGS} (organization_id, title, content, song)
         select $1, 'Song ' || n, repeat('la ', 1000), '{}'
         from generate_series(1, 200) n`,
        [orgId],
      );

      expect(await sync()).toMatchObject({ pushed: 200, pushRejected: 0 });
      expect(fake.tables.get(SONGS)).toHaveLength(200);
    });

    it("pushes a delete made here", async () => {
      fake.tables.set(SONGS, [
        cloudSong("Amazing Grace", "2026-01-01T00:00:00+00:00"),
      ]);
      await sync();
      await query(`delete from ${SONGS} where id = $1`, [SONG_ID]);

      const result = await sync();

      expect(result.pushed).toBe(1);
      expect(fake.tables.get(SONGS)).toEqual([]);
    });

    it("keeps a row edited here that the cloud deleted, and puts it back", async () => {
      fake.tables.set(SONGS, [
        cloudSong("Amazing Grace", "2026-01-01T00:00:00+00:00"),
      ]);
      await sync();
      await query(`update ${SONGS} set title = 'Still needed' where id = $1`, [
        SONG_ID,
      ]);
      fake.tables.set(SONGS, []);

      const result = await sync();

      expect(result).toMatchObject({ deletedLocally: 0, pushed: 1 });
      expect((await localSongs()).map((s) => s.title)).toEqual([
        "Still needed",
      ]);
      expect(fake.tables.get(SONGS)).toMatchObject([
        { id: SONG_ID, title: "Still needed" },
      ]);
    });

    it("brings back a row deleted here that the cloud edited", async () => {
      fake.tables.set(SONGS, [
        cloudSong("Amazing Grace", "2026-01-01T00:00:00+00:00"),
      ]);
      await sync();
      await query(`delete from ${SONGS} where id = $1`, [SONG_ID]);
      fake.tables.set(SONGS, [
        cloudSong("Amazing Grace (Live)", "2026-01-02T00:00:00+00:00"),
      ]);

      const result = await sync();

      expect(result).toMatchObject({ pulled: 1, pushed: 0 });
      expect(fake.pushed.get(SONGS)).toBeUndefined();
      expect((await localSongs()).map((s) => s.title)).toEqual([
        "Amazing Grace (Live)",
      ]);
    });

    it("keeps a rejected push and sends it again next sync", async () => {
      await insertLocalSong(LOCAL_SONG_ID, "Written offline");
      fake.rejectPushes = true;

      const rejected = await sync();

      expect(rejected).toMatchObject({ pushed: 0, pushRejected: 1 });
      expect(await localSongs()).toHaveLength(1);

      fake.rejectPushes = false;
      const retried = await sync();

      expect(retried).toMatchObject({ pushed: 1, pushRejected: 0 });
    });

    it("pushes a use after the song it refers to", async () => {
      await insertLocalSong(LOCAL_SONG_ID, "Written offline");
      await query(
        `insert into ${RECENT_SONGS} (id, organization_id, saved_song_id, created_at)
         values ('0e000000-0000-4000-8000-000000000009', $1, $2, '2026-03-01T10:00:00Z')`,
        [orgId, LOCAL_SONG_ID],
      );

      await sync();

      expect(fake.tables.get(RECENT_SONGS)).toMatchObject([
        {
          saved_song_id: LOCAL_SONG_ID,
          created_at: "2026-03-01T10:00:00+00:00",
        },
      ]);
      expect(fake.tables.get(SONGS)).toHaveLength(1);
    });

    it("leaves local rows alone when the cloud refuses the organization", async () => {
      fake.tables.set(SONGS, [
        cloudSong("Amazing Grace", "2026-01-01T00:00:00+00:00"),
      ]);
      await sync();
      fake.orgMissing = true;

      const result = await sync();

      expect(result.failedTables).toBeGreaterThan(0);
      expect(await localSongs()).toHaveLength(1);
    });
  });

  describe("categories", () => {
    const cloudCategory = (name: string): Row => ({
      id: "ca700000-0000-4000-8000-000000000001",
      name,
      organization_id: CLOUD_ORG_ID,
      created_at: "2026-01-01T00:00:00+00:00",
      updated_at: "2026-01-01T00:00:00+00:00",
    });
    const localCategories = () =>
      query(
        `select id, name from ${CATEGORIES} where organization_id = $1 order by name`,
        [orgId],
      );

    it("matches by name, keeping each side's own id", async () => {
      const [{ id: localId }] = await query(
        `insert into ${CATEGORIES} (organization_id, name) values ($1, 'Sunday') returning id`,
        [orgId],
      );
      fake.tables.set(CATEGORIES, [cloudCategory("Sunday")]);

      const result = await sync();

      // Projects refer to categories by id, so the local id must not change.
      expect(await localCategories()).toEqual([
        { id: localId, name: "Sunday" },
      ]);
      expect(result).toMatchObject({ pulled: 0, conflicts: 0, pushed: 0 });
    });

    it("pushes a rename as a delete of the old name and a create of the new", async () => {
      fake.tables.set(CATEGORIES, [cloudCategory("Sunday")]);
      await sync();
      await query(
        `update ${CATEGORIES} set name = 'Sunday AM'
         where organization_id = $1 and name = 'Sunday'`,
        [orgId],
      );

      const result = await sync();

      expect(result).toMatchObject({ pushed: 2, pushRejected: 0 });
      expect(fake.tables.get(CATEGORIES)!.map((r) => r.name)).toEqual([
        "Sunday AM",
      ]);
    });
  });
});
