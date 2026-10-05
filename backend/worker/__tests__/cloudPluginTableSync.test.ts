import { runPluginMigrations } from "@repo/base-plugin/server";
import { Server, createServer } from "http";
import { AddressInfo } from "net";
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
import {
  CloudSyncTable,
  introspectCloudSyncTables,
} from "../../backend-shared/src/cloud/sync/pluginTableIntrospection";
import { syncPluginTables } from "../../backend-shared/src/cloud/sync/pluginTables";
import { WithPgClient } from "../../backend-shared/src/types";

/**
 * The local half of plugin table sync, against a real database. The cloud is
 * faked in-process so each test can stage whatever the cloud holds; the
 * e2e "cloud" shares the local database, where rows that keep the cloud's id
 * cannot exist in two orgs at once.
 */

const SONGS = "plugin_lyrics_presenter.saved_song";
const SETLIST_SOURCES = "plugin_lyrics_presenter.setlist_source";
const BIBLE_PREFERENCES = "plugin_bible.bible_preference";
const RECENT_SONGS = "plugin_lyrics_presenter.recent_song";
const ORG_PREFIX = "testpluginsync";

type Row = Record<string, unknown>;

/** Key order differs between Postgres jsonb and JS, so compare sorted. */
const stableKey = (key: unknown) =>
  JSON.stringify(key, Object.keys(key as object).sort());

/** Answers the two cloud fields from rows the test puts in `tables`. */
const startFakeCloud = async (syncTables: CloudSyncTable[]) => {
  const fake = {
    url: "",
    tables: new Map<string, Row[]>(),
    /** Keys requested from `cloudPluginTableRows`, per entity. */
    downloaded: new Map<string, unknown[]>(),
    unsupported: false,
    server: null as Server | null,
  };

  const rowKey = (entity: string, row: Row) => {
    const table = syncTables.find((t) => `${t.schema}.${t.table}` === entity)!;
    return Object.fromEntries(table.rowKeyColumns.map((c) => [c, row[c]]));
  };

  fake.server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const { query, variables } = JSON.parse(body);
      const entity = `${variables.schemaName}.${variables.tableName}`;
      const rows = fake.tables.get(entity) ?? [];
      let response: object;

      if (fake.unsupported) {
        response = {
          errors: [
            {
              message:
                'Cannot query field "cloudPluginTableKeys" on type "Query".',
            },
          ],
        };
      } else if (query.includes("cloudPluginTableKeys(")) {
        response = {
          data: {
            cloudPluginTableKeys: rows.map((r) => ({
              key: rowKey(entity, r),
              updatedAt: r.updated_at,
            })),
          },
        };
      } else {
        const wanted = new Set((variables.keys as unknown[]).map(stableKey));
        fake.downloaded.set(entity, [
          ...(fake.downloaded.get(entity) ?? []),
          ...variables.keys,
        ]);
        response = {
          data: {
            cloudPluginTableRows: rows.filter((r) =>
              wanted.has(stableKey(rowKey(entity, r))),
            ),
          },
        };
      }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(response));
    });
  });
  await new Promise<void>((resolve) => fake.server!.listen(0, resolve));
  fake.url = `http://localhost:${(fake.server.address() as AddressInfo).port}`;
  return fake;
};

let pool: Pool;
let fake: Awaited<ReturnType<typeof startFakeCloud>>;
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
  organization_id: "c0000000-0000-4000-8000-000000000001",
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
  await new Promise((resolve) => fake.server!.close(resolve));
});

beforeEach(async () => {
  fake.tables.clear();
  fake.downloaded.clear();
  fake.unsupported = false;

  // Sync commits its own transactions, so tests write real rows and clean up
  // by org instead of rolling back.
  [{ id: orgId }] = await query(
    `insert into app_public.organizations (slug, name)
     values ($1, 'Plugin sync') returning id`,
    [`${ORG_PREFIX}-${Date.now()}`],
  );
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

  it("leaves an edit made only locally alone", async () => {
    fake.tables.set(SONGS, [
      cloudSong("Amazing Grace", "2026-01-01T00:00:00+00:00"),
    ]);
    await sync();
    await query(`update ${SONGS} set title = 'Edited here' where id = $1`, [
      SONG_ID,
    ]);

    await sync();

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
  });

  it("counts a cloud delete without deleting locally", async () => {
    fake.tables.set(SONGS, [
      cloudSong("Amazing Grace", "2026-01-01T00:00:00+00:00"),
    ]);
    await sync();
    fake.tables.set(SONGS, []);

    const result = await sync();

    expect(result.deletedOnCloud).toBe(1);
    expect(await localSongs()).toHaveLength(1);
  });

  it("matches composite keys and keeps local user attribution on overwrite", async () => {
    await query(
      `insert into ${SETLIST_SOURCES} (organization_id, source, enabled, enabled_by_user_id)
       values ($1, 'myworshiplist', true, $2)`,
      [orgId, userId],
    );
    const cloudSource = (enabled: boolean, updatedAt: string) => ({
      organization_id: "c0000000-0000-4000-8000-000000000001",
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
        organization_id: "c0000000-0000-4000-8000-000000000001",
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
      organization_id: "c0000000-0000-4000-8000-000000000001",
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
});
