import { runPluginMigrations } from "@repo/base-plugin/server";
import path from "path";
import { PoolClient } from "pg";
import { beforeAll, describe, expect, it } from "vitest";

import { TEST_DATABASE_URL, poolFromUrl } from "../../__tests__/helpers";
import {
  applyPushedChanges,
  findCloudOrganizationId,
  listCloudRowKeys,
} from "../../backend-shared/src/cloud/sync/pluginTables/cloud";
import {
  CloudSyncTable,
  introspectCloudSyncTables,
} from "../../backend-shared/src/cloud/sync/pluginTables/introspection";

/**
 * The cloud's side of plugin table sync: what a connected instance's pushes do
 * to the cloud's rows. Each test runs in a transaction that is rolled back.
 */

const SONG_ID = "5a1e0000-0000-4000-8000-000000000001";
const OTHER_ORG_ID = "07e00000-0000-4000-8000-000000000001";

let tables: CloudSyncTable[];
const tableNamed = (name: string) => tables.find((t) => t.table === name)!;

beforeAll(async () => {
  const pool = poolFromUrl(TEST_DATABASE_URL);
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
  ({ tables } = await introspectCloudSyncTables(pool));
});

const inCloud = async (
  fn: (ctx: {
    client: PoolClient;
    orgId: string;
    userId: string;
  }) => Promise<void>,
) => {
  const client = await poolFromUrl(TEST_DATABASE_URL).connect();
  await client.query("begin");
  try {
    const {
      rows: [{ id: orgId }],
    } = await client.query(
      `insert into app_public.organizations (slug, name)
       values ('testpluginserve', 'Cloud') returning id`,
    );
    const {
      rows: [{ id: userId }],
    } = await client.query(
      `select id from app_private.really_create_user(
         username := 'testuser_pluginserve', email := 'testuser_pluginserve@example.com',
         email_is_verified := true, name := 'Pusher', avatar_url := null,
         password := 'TestUserPassword')`,
    );
    await fn({ client, orgId, userId });
  } finally {
    await client.query("rollback");
    client.release();
  }
};

const localSong = (title: string): Record<string, unknown> => ({
  id: SONG_ID,
  // The pushing instance's own org and user: never taken by the cloud.
  organization_id: OTHER_ORG_ID,
  created_by_user_id: "05e70000-0000-4000-8000-000000000001",
  title,
  content: "",
  source: "manual",
  song: { title },
  video_backgrounds: [],
  created_at: "2026-01-01T00:00:00+00:00",
  updated_at: "2026-01-01T00:00:00+00:00",
});

const songRow = async (client: PoolClient) =>
  (
    await client.query(
      `select organization_id, created_by_user_id, title
       from plugin_lyrics_presenter.saved_song where id = $1`,
      [SONG_ID],
    )
  ).rows[0];

describe("applyPushedChanges", () => {
  it("creates a row under the cloud org and the pushing user", async () => {
    await inCloud(async ({ client, orgId, userId }) => {
      const [result] = await applyPushedChanges(
        client,
        tableNamed("saved_song"),
        orgId,
        userId,
        [
          {
            key: { id: SONG_ID },
            expectedUpdatedAt: null,
            row: localSong("New"),
          },
        ],
      );

      expect(result).toMatchObject({ status: "applied" });
      expect(await songRow(client)).toEqual({
        organization_id: orgId,
        created_by_user_id: userId,
        title: "New",
      });
      // Must match what key listings report, or the pushing instance would
      // see its own write as a cloud change and download it again.
      const [listed] = await listCloudRowKeys(
        client,
        tableNamed("saved_song"),
        orgId,
      );
      expect((result as { updatedAt: string }).updatedAt).toBe(
        listed!.updatedAt,
      );
    });
  });

  it("refuses to create over a row that already exists", async () => {
    await inCloud(async ({ client, orgId, userId }) => {
      const table = tableNamed("saved_song");
      const create = {
        key: { id: SONG_ID },
        expectedUpdatedAt: null,
        row: localSong("First"),
      };
      await applyPushedChanges(client, table, orgId, userId, [create]);

      const [result] = await applyPushedChanges(client, table, orgId, userId, [
        { ...create, row: localSong("Second") },
      ]);

      expect(result).toEqual({
        status: "rejected",
        reason: "changed on the cloud",
      });
      expect((await songRow(client)).title).toBe("First");
    });
  });

  it("updates and deletes only the version the change was based on", async () => {
    await inCloud(async ({ client, orgId, userId }) => {
      const table = tableNamed("saved_song");
      const key = { id: SONG_ID };
      const [created] = (await applyPushedChanges(
        client,
        table,
        orgId,
        userId,
        [{ key, expectedUpdatedAt: null, row: localSong("Original") }],
      )) as { updatedAt: string }[];

      const [stale] = await applyPushedChanges(client, table, orgId, userId, [
        {
          key,
          expectedUpdatedAt: "2020-01-01T00:00:00+00:00",
          row: localSong("Stale"),
        },
      ]);
      expect(stale).toMatchObject({ status: "rejected" });

      const [updated] = (await applyPushedChanges(client, table, orgId, null, [
        {
          key,
          expectedUpdatedAt: created!.updatedAt,
          row: localSong("Edited"),
        },
      ])) as { status: string; updatedAt: string }[];
      expect(updated!.status).toBe("applied");
      // The cloud keeps its own user reference on update.
      expect(await songRow(client)).toMatchObject({
        title: "Edited",
        created_by_user_id: userId,
      });

      const [staleDelete] = await applyPushedChanges(
        client,
        table,
        orgId,
        userId,
        [{ key, expectedUpdatedAt: created!.updatedAt, row: null }],
      );
      expect(staleDelete).toMatchObject({ status: "rejected" });

      const [deleted] = await applyPushedChanges(client, table, orgId, userId, [
        { key, expectedUpdatedAt: updated!.updatedAt, row: null },
      ]);
      expect(deleted).toEqual({ status: "applied", updatedAt: null });
      expect(await songRow(client)).toBeUndefined();
    });
  });

  it("rejects only the change that fails, keeping the rest of the batch", async () => {
    await inCloud(async ({ client, orgId, userId }) => {
      const results = await applyPushedChanges(
        client,
        tableNamed("recent_song"),
        orgId,
        userId,
        [
          {
            key: { id: "0e000000-0000-4000-8000-000000000001" },
            expectedUpdatedAt: null,
            // The song it refers to is not on the cloud.
            row: {
              id: "0e000000-0000-4000-8000-000000000001",
              saved_song_id: SONG_ID,
              created_at: "2026-03-01T10:00:00+00:00",
              updated_at: "2026-03-01T10:00:00+00:00",
            },
          },
          {
            key: { id: "0e000000-0000-4000-8000-000000000002" },
            expectedUpdatedAt: null,
            row: {
              id: "0e000000-0000-4000-8000-000000000002",
              saved_song_id: null,
              created_at: "2026-03-01T10:00:00+00:00",
              updated_at: "2026-03-01T10:00:00+00:00",
            },
          },
        ],
      );

      expect(results.map((r) => r.status)).toEqual(["rejected", "applied"]);
      // A use keeps when it happened: this table has no timestamps trigger.
      expect(
        (
          await client.query(
            `select created_at from plugin_lyrics_presenter.recent_song
             where organization_id = $1`,
            [orgId],
          )
        ).rows,
      ).toEqual([{ created_at: new Date("2026-03-01T10:00:00Z") }]);
    });
  });
});

describe("findCloudOrganizationId", () => {
  it("refuses an organization the caller cannot see", async () => {
    await inCloud(async ({ client }) => {
      await expect(
        findCloudOrganizationId(client, "testpluginserve-missing"),
      ).rejects.toThrow("Organization not found");
    });
  });
});

describe("as the cloud's visitor role", () => {
  /** Run as `userId`, a member of `orgId`, the way GraphQL requests do. */
  const becomeMember = async (
    client: PoolClient,
    orgId: string,
    userId: string,
  ) => {
    await client.query(
      `insert into app_public.organization_memberships (organization_id, user_id, is_owner)
       values ($1, $2, true)`,
      [orgId, userId],
    );
    const {
      rows: [session],
    } = await client.query(
      "insert into app_private.sessions (user_id) values ($1) returning uuid",
      [userId],
    );
    await client.query(
      `select set_config('role', $1, true), set_config('jwt.claims.session_id', $2, true)`,
      [process.env.DATABASE_VISITOR, session.uuid],
    );
  };

  it("pushes to a core table whose grants cover only some columns", async () => {
    await inCloud(async ({ client, orgId, userId }) => {
      await becomeMember(client, orgId, userId);
      const table = tableNamed("tags");
      const tag = (name: string, color: string) => ({
        // The pushing instance's own id: never used by the cloud.
        id: "7a900000-0000-4000-8000-000000000001",
        name,
        description: null,
        background_color: color,
        foreground_color: "#000",
        variant: "solid",
        organization_id: OTHER_ORG_ID,
        created_at: "2026-01-01T00:00:00+00:00",
        updated_at: "2026-01-01T00:00:00+00:00",
      });
      const visibleOrg = await findCloudOrganizationId(
        client,
        "testpluginserve",
      );
      expect(visibleOrg).toBe(orgId);

      const [created] = (await applyPushedChanges(
        client,
        table,
        orgId,
        userId,
        [
          {
            key: { name: "Youth" },
            expectedUpdatedAt: null,
            row: tag("Youth", "#f00"),
          },
        ],
      )) as { status: string; updatedAt: string }[];
      expect(created).toMatchObject({ status: "applied" });

      const [updated] = (await applyPushedChanges(
        client,
        table,
        orgId,
        userId,
        [
          {
            key: { name: "Youth" },
            expectedUpdatedAt: created!.updatedAt,
            row: tag("Youth", "#0f0"),
          },
        ],
      )) as { status: string; updatedAt: string }[];
      expect(updated).toMatchObject({ status: "applied" });

      const { rows } = await client.query(
        `select id, background_color from app_public.tags where organization_id = $1`,
        [orgId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].background_color).toBe("#0f0");
      expect(rows[0].id).not.toBe("7a900000-0000-4000-8000-000000000001");

      const [deleted] = await applyPushedChanges(client, table, orgId, userId, [
        {
          key: { name: "Youth" },
          expectedUpdatedAt: updated!.updatedAt,
          row: null,
        },
      ]);
      expect(deleted).toMatchObject({ status: "applied" });
    });
  });

  it("refuses an organization the user is not a member of", async () => {
    await inCloud(async ({ client, orgId, userId }) => {
      await client.query(
        `insert into app_public.organizations (slug, name) values ('testpluginserve-other', 'Other')`,
      );
      await becomeMember(client, orgId, userId);

      await expect(
        findCloudOrganizationId(client, "testpluginserve-other"),
      ).rejects.toThrow("Organization not found");
    });
  });
});
