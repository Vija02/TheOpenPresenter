import { PoolClient } from "pg";
import { describe, expect, it } from "vitest";

import { TEST_DATABASE_URL, poolFromUrl } from "../../__tests__/helpers";
import { findCloudOrganizationId } from "../../backend-shared/src/cloud/sync/pluginTables/cloud";
import {
  applyPushedProjectChanges,
  listCloudProjects,
} from "../../backend-shared/src/cloud/sync/projects/cloud";
import { ProjectSyncValue } from "../../backend-shared/src/cloud/sync/projects/value";

/**
 * The cloud's side of project sync, as the cloud's visitor role so grants and
 * RLS apply. Each test runs in a transaction that is rolled back.
 */

const PROJECT_ID = "9a000000-0000-4000-8000-000000000001";
const OTHER_ID = "9a000000-0000-4000-8000-000000000002";

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

const asMember = async (
  fn: (ctx: {
    client: PoolClient;
    orgId: string;
    userId: string;
  }) => Promise<void>,
  /** Runs before the role switch, for rows the user could not write. */
  setup?: (ctx: { client: PoolClient; orgId: string }) => Promise<void>,
) => {
  const client = await poolFromUrl(TEST_DATABASE_URL).connect();
  await client.query("begin");
  try {
    const {
      rows: [{ id: orgId }],
    } = await client.query(
      `insert into app_public.organizations (slug, name)
       values ('testprojectserve', 'Cloud') returning id`,
    );
    await client.query(
      `insert into app_public.tags (organization_id, name)
       values ($1, 'band'), ($1, 'choir')`,
      [orgId],
    );
    await client.query(
      `insert into app_public.categories (organization_id, name)
       values ($1, 'Sunday')`,
      [orgId],
    );
    const {
      rows: [{ id: userId }],
    } = await client.query(
      `select id from app_private.really_create_user(
         username := 'testuser_projectserve', email := 'testuser_projectserve@example.com',
         email_is_verified := true, name := 'Pusher', avatar_url := null,
         password := 'TestUserPassword')`,
    );
    await setup?.({ client, orgId });
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
    await fn({ client, orgId, userId });
  } finally {
    await client.query("rollback");
    client.release();
  }
};

const create = (id: string, projectValue: ProjectSyncValue) => ({
  id,
  expected: null,
  value: projectValue,
  slug: "pushed",
});

describe("applyPushedProjectChanges", () => {
  it("creates a project under the pushed id, with categories and tags by name", async () => {
    await asMember(async ({ client, orgId, userId }) => {
      const pushed = value("Easter", {
        targetDate: "2027-03-28T09:30:00.123456Z",
        category: "Sunday",
        tags: ["band", "choir"],
      });

      const [result] = await applyPushedProjectChanges(client, orgId, userId, [
        create(PROJECT_ID, pushed),
      ]);

      expect(result).toMatchObject({ status: "applied" });
      // Listed with exactly the value that was pushed, so the next sync on the
      // other side sees no change.
      expect(await listCloudProjects(client, orgId)).toEqual([
        {
          id: PROJECT_ID,
          createdAt: expect.any(String),
          updatedAt: (result as { updatedAt: string }).updatedAt,
          value: pushed,
        },
      ]);
      const {
        rows: [project],
      } = await client.query(
        "select creator_user_id from app_public.projects where id = $1",
        [PROJECT_ID],
      );
      expect(project.creator_user_id).toBe(userId);
    });
  });

  it("treats a create it already applied as applied", async () => {
    await asMember(async ({ client, orgId, userId }) => {
      const [first] = await applyPushedProjectChanges(client, orgId, userId, [
        create(PROJECT_ID, value("Easter")),
      ]);
      const [again, clash] = await applyPushedProjectChanges(
        client,
        orgId,
        userId,
        [
          create(PROJECT_ID, value("Easter")),
          // Same id, different content: not a retry.
          create(PROJECT_ID, value("Other")),
        ],
      );

      expect(again).toEqual(first);
      expect(clash).toMatchObject({ status: "rejected" });
    });
  });

  it("rejects only the change naming a tag the cloud lacks", async () => {
    await asMember(async ({ client, orgId, userId }) => {
      const results = await applyPushedProjectChanges(client, orgId, userId, [
        create(PROJECT_ID, value("Easter", { tags: ["drums"] })),
        create(OTHER_ID, value("Christmas", { tags: ["band"] })),
      ]);

      expect(results).toEqual([
        { status: "rejected", reason: 'the cloud has no tag "drums"' },
        expect.objectContaining({ status: "applied" }),
      ]);
      // The rejected create left nothing behind.
      expect((await listCloudProjects(client, orgId)).map((p) => p.id)).toEqual(
        [OTHER_ID],
      );
    });
  });

  it("updates only if the metadata is still what the change was based on", async () => {
    await asMember(async ({ client, orgId, userId }) => {
      const [created] = (await applyPushedProjectChanges(
        client,
        orgId,
        userId,
        [create(PROJECT_ID, value("Easter", { tags: ["band"] }))],
      )) as { updatedAt: string }[];
      const synced = {
        value: value("Easter", { tags: ["band"] }),
        updatedAt: created!.updatedAt,
      };

      const [stale, updated] = await applyPushedProjectChanges(
        client,
        orgId,
        userId,
        [
          {
            id: PROJECT_ID,
            expected: { ...synced, value: value("Something else") },
            value: value("Stale"),
          },
          {
            id: PROJECT_ID,
            expected: synced,
            value: value("Easter Sunday", { tags: ["choir"] }),
          },
        ],
      );

      expect(stale).toEqual({
        status: "rejected",
        reason: "changed on the cloud",
      });
      expect(updated).toMatchObject({ status: "applied" });
      const [project] = await listCloudProjects(client, orgId);
      expect(project!.value).toEqual(
        value("Easter Sunday", { tags: ["choir"] }),
      );
    });
  });

  it("deletes only if neither metadata nor document changed since", async () => {
    await asMember(async ({ client, orgId, userId }) => {
      const [created] = (await applyPushedProjectChanges(
        client,
        orgId,
        userId,
        [create(PROJECT_ID, value("Easter"))],
      )) as { updatedAt: string }[];
      const remove = {
        id: PROJECT_ID,
        expected: { value: value("Easter"), updatedAt: created!.updatedAt },
        value: null,
      };

      // Any write moves `updated_at`, as a document save on the cloud does.
      await client.query(
        "update app_public.projects set slug = 'moved' where id = $1",
        [PROJECT_ID],
      );
      const [kept] = await applyPushedProjectChanges(client, orgId, userId, [
        remove,
      ]);
      expect(kept).toMatchObject({ status: "rejected" });

      const [{ updatedAt }] = await listCloudProjects(client, orgId);
      const [deleted] = await applyPushedProjectChanges(client, orgId, userId, [
        { ...remove, expected: { ...remove.expected, updatedAt } },
      ]);
      expect(deleted).toEqual({ status: "applied", updatedAt: null });
      expect(await listCloudProjects(client, orgId)).toEqual([]);
    });
  });

  it("rejects a change naming a category the cloud lacks", async () => {
    await asMember(async ({ client, orgId, userId }) => {
      const [result] = await applyPushedProjectChanges(client, orgId, userId, [
        create(PROJECT_ID, value("Easter", { category: "Weddings" })),
      ]);

      expect(result).toEqual({
        status: "rejected",
        reason: 'the cloud has no category "Weddings"',
      });
      expect(await listCloudProjects(client, orgId)).toEqual([]);
    });
  });

  it("rejects an update or delete of a project it does not have", async () => {
    await asMember(async ({ client, orgId, userId }) => {
      const expected = {
        value: value("Easter"),
        updatedAt: "2027-01-01T00:00:00Z",
      };
      expect(
        await applyPushedProjectChanges(client, orgId, userId, [
          { id: PROJECT_ID, expected, value: value("Edited") },
          { id: PROJECT_ID, expected, value: null },
        ]),
      ).toEqual([
        { status: "rejected", reason: "missing on the cloud" },
        { status: "rejected", reason: "missing on the cloud" },
      ]);
    });
  });

  it("rejects a create whose id another organization holds, and carries on", async () => {
    await asMember(
      async ({ client, orgId, userId }) => {
        const results = await applyPushedProjectChanges(client, orgId, userId, [
          create(PROJECT_ID, value("Mine")),
          create(OTHER_ID, value("Next")),
        ]);

        expect(results).toEqual([
          expect.objectContaining({ status: "rejected" }),
          expect.objectContaining({ status: "applied" }),
        ]);
        expect(
          (await listCloudProjects(client, orgId)).map((p) => p.id),
        ).toEqual([OTHER_ID]);
      },
      async ({ client }) => {
        const {
          rows: [{ id: otherOrg }],
        } = await client.query(
          `insert into app_public.organizations (slug, name)
           values ('testprojectserve-other', 'Other') returning id`,
        );
        await client.query(
          `insert into app_public.projects (id, organization_id, slug, name)
           values ($1, $2, 'theirs', 'Theirs')`,
          [PROJECT_ID, otherOrg],
        );
      },
    );
  });

  it("clears a category and tags", async () => {
    await asMember(async ({ client, orgId, userId }) => {
      const full = value("Easter", { category: "Sunday", tags: ["band"] });
      const [created] = (await applyPushedProjectChanges(
        client,
        orgId,
        userId,
        [create(PROJECT_ID, full)],
      )) as { updatedAt: string }[];

      const [updated] = await applyPushedProjectChanges(client, orgId, userId, [
        {
          id: PROJECT_ID,
          expected: { value: full, updatedAt: created!.updatedAt },
          value: value("Easter"),
        },
      ]);

      expect(updated).toMatchObject({ status: "applied" });
      expect((await listCloudProjects(client, orgId))[0]!.value).toEqual(
        value("Easter"),
      );
    });
  });
});

describe("listCloudProjects", () => {
  it("builds the same value whatever the server's time zone and locale", async () => {
    await asMember(async ({ client, orgId, userId }) => {
      await client.query(
        `insert into app_public.tags (organization_id, name)
         values ($1, 'Zebra'), ($1, 'alpha')`,
        [orgId],
      );
      await applyPushedProjectChanges(client, orgId, userId, [
        create(
          PROJECT_ID,
          value("Easter", {
            targetDate: "2027-03-28T09:30:00.123456Z",
            tags: ["Zebra", "alpha", "band"],
          }),
        ),
      ]);

      await client.query("set local timezone = 'Australia/Sydney'");
      const [project] = await listCloudProjects(client, orgId);

      expect(project!.value).toEqual(
        value("Easter", {
          targetDate: "2027-03-28T09:30:00.123456Z",
          // Byte order, so both sides agree: capitals first.
          tags: ["Zebra", "alpha", "band"],
        }),
      );
    });
  });

  it("leaves out temporary projects", async () => {
    await asMember(
      async ({ client, orgId }) => {
        expect(await listCloudProjects(client, orgId)).toEqual([]);
      },
      async ({ client, orgId }) => {
        await client.query(
          `insert into app_public.projects (organization_id, slug, name, is_temporary)
           values ($1, 'guest', 'Guest', true)`,
          [orgId],
        );
      },
    );
  });
});

describe("findCloudOrganizationId", () => {
  it("refuses an organization the user is not a member of", async () => {
    await asMember(async ({ client }) => {
      await expect(
        findCloudOrganizationId(client, "testprojectserve-other"),
      ).rejects.toThrow("Organization not found");
    });
  });
});
