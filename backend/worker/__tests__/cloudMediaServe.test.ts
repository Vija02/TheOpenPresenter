import { PoolClient } from "pg";
import { describe, expect, it } from "vitest";

import { TEST_DATABASE_URL, poolFromUrl } from "../../__tests__/helpers";
import {
  applyPushedLinks,
  applyPushedMediaMetadata,
  deleteSyncedMedia,
  listCloudMediaPage,
} from "../../backend-shared/src/cloud/sync/media/cloud";
import { emptyMediaMetadata } from "../../backend-shared/src/cloud/sync/media/metadata";

/**
 * The cloud's side of media sync, as the visitor role so RLS applies, with
 * root writes where the resolver uses the root pool. Each test runs in a
 * transaction that is rolled back.
 */

const PLUGIN_ID = "b1000000-0000-4000-8000-000000000001";

type Ctx = {
  /** The caller's connection, as the visitor role. */
  client: PoolClient;
  /** The same connection as the owner, for what the resolver does as root. */
  root: { query: PoolClient["query"] };
  orgId: string;
  otherOrgId: string;
  projectId: string;
  otherProjectId: string;
  media: (name: string, org?: string, complete?: boolean) => Promise<string>;
};

const asMember = async (fn: (ctx: Ctx) => Promise<void>) => {
  const client = await poolFromUrl(TEST_DATABASE_URL).connect();
  await client.query("begin");
  try {
    const one = async (sql: string, params: unknown[] = []) =>
      (await client.query(sql, params)).rows[0];
    const { id: orgId } = await one(
      `insert into app_public.organizations (slug, name)
       values ('testmediaserve', 'Cloud') returning id`,
    );
    const { id: otherOrgId } = await one(
      `insert into app_public.organizations (slug, name)
       values ('testmediaserve-other', 'Other') returning id`,
    );
    const { id: userId } = await one(
      `select id from app_private.really_create_user(
         username := 'testuser_mediaserve', email := 'testuser_mediaserve@example.com',
         email_is_verified := true, name := 'Pusher', avatar_url := null,
         password := 'TestUserPassword')`,
    );
    const { id: projectId } = await one(
      `insert into app_public.projects (organization_id, slug, name)
       values ($1, 'p', 'P') returning id`,
      [orgId],
    );
    const { id: otherProjectId } = await one(
      `insert into app_public.projects (organization_id, slug, name)
       values ($1, 'o', 'O') returning id`,
      [otherOrgId],
    );
    await client.query(
      `insert into app_public.organization_memberships (organization_id, user_id, is_owner)
       values ($1, $2, true)`,
      [orgId, userId],
    );
    const { uuid: sessionId } = await one(
      "insert into app_private.sessions (user_id) values ($1) returning uuid",
      [userId],
    );
    const becomeVisitor = () =>
      client.query(
        `select set_config('role', $1, true), set_config('jwt.claims.session_id', $2, true)`,
        [process.env.DATABASE_VISITOR, sessionId],
      );
    const root = {
      query: (async (sql: string, params?: unknown[]) => {
        await client.query("reset role");
        try {
          return await client.query(sql, params);
        } finally {
          await becomeVisitor();
        }
      }) as PoolClient["query"],
    };
    let n = 0;
    const media = async (name: string, org = orgId, complete = true) => {
      n += 1;
      const { rows } = await root.query(
        `insert into app_public.medias
           (media_name, file_offset, organization_id, is_complete, file_size)
         values ($1, 0, $2, $3, 1) returning id`,
        [`${name}${n}.jpg`, org, complete],
      );
      return rows[0].id as string;
    };
    await becomeVisitor();
    await fn({
      client,
      root,
      orgId,
      otherOrgId,
      projectId,
      otherProjectId,
      media,
    });
  } finally {
    await client.query("rollback");
    client.release();
  }
};

describe("listCloudMediaPage", () => {
  it("pages through complete media of the organization, with their metadata and links", async () => {
    await asMember(
      async ({ client, root, orgId, otherOrgId, projectId, media }) => {
        const a = await media("a");
        const b = await media("b");
        const c = await media("c");
        await media("incomplete", orgId, false);
        await media("elsewhere", otherOrgId);
        await root.query(
          `insert into app_public.media_dependencies (parent_media_id, child_media_id)
         values ($1, $2)`,
          [a, b],
        );
        await root.query(
          `insert into app_public.project_medias (project_id, media_id, plugin_id)
         values ($1, $2, $3)`,
          [projectId, c, PLUGIN_ID],
        );

        const ids = [a, b, c].sort();
        const first = await listCloudMediaPage(client, orgId, null, 2);
        const second = await listCloudMediaPage(
          client,
          orgId,
          first.endCursor,
          2,
        );

        expect(first.media.map((m) => m.id)).toEqual(ids.slice(0, 2));
        expect(first.endCursor).toBe(ids[1]);
        expect(second.media.map((m) => m.id)).toEqual(ids.slice(2));
        expect(second.endCursor).toBeNull();
        expect([
          ...first.metadata.dependencies,
          ...second.metadata.dependencies,
        ]).toEqual([{ parentMediaId: a, childMediaId: b }]);
        expect([...first.links, ...second.links]).toEqual([
          { projectId, mediaId: c, pluginId: PLUGIN_ID },
        ]);
      },
    );
  });
});

describe("applyPushedMediaMetadata", () => {
  it("writes rows for the organization's media and drops any naming another's", async () => {
    await asMember(async ({ client, root, orgId, otherOrgId, media }) => {
      const mine = await media("mine");
      const child = await media("child");
      const theirs = await media("theirs", otherOrgId);

      const result = await applyPushedMediaMetadata(client, root, orgId, {
        ...emptyMediaMetadata(),
        dependencies: [
          { parentMediaId: mine, childMediaId: child },
          { parentMediaId: theirs, childMediaId: child },
        ],
        imageMetadata: [
          { imageMediaId: mine, width: 10, height: 20 },
          { imageMediaId: theirs, width: 1, height: 1 },
        ],
      });

      expect(result).toEqual({ written: 2, dropped: 2 });
      const { rows } = await root.query(
        "select parent_media_id from app_public.media_dependencies where child_media_id = $1",
        [child],
      );
      expect(rows).toEqual([{ parent_media_id: mine }]);
      const { rows: images } = await root.query(
        "select image_media_id from app_public.media_image_metadata where image_media_id = any($1)",
        [[mine, theirs]],
      );
      expect(images).toEqual([{ image_media_id: mine }]);
    });
  });
});

describe("applyPushedLinks", () => {
  it("adds and removes links, refusing another organization's projects", async () => {
    await asMember(
      async ({ client, orgId, projectId, otherProjectId, media }) => {
        const m = await media("m");
        const link = { projectId, mediaId: m, pluginId: PLUGIN_ID };

        expect(
          await applyPushedLinks(client, orgId, [
            { ...link, remove: false },
            { ...link, projectId: otherProjectId, remove: false },
          ]),
        ).toEqual(["applied", "rejected"]);
        expect(
          (await client.query("select media_id from app_public.project_medias"))
            .rows,
        ).toEqual([{ media_id: m }]);

        expect(
          await applyPushedLinks(client, orgId, [{ ...link, remove: true }]),
        ).toEqual(["applied"]);
        expect(
          (await client.query("select 1 from app_public.project_medias")).rows,
        ).toEqual([]);
      },
    );
  });
});

describe("deleteSyncedMedia", () => {
  it("deletes only unused media of the organization", async () => {
    await asMember(
      async ({ client, root, orgId, otherOrgId, projectId, media }) => {
        const unused = await media("unused");
        const used = await media("used");
        const pdf = await media("pdf");
        const page = await media("page");
        const theirs = await media("theirs", otherOrgId);
        await root.query(
          `insert into app_public.media_dependencies (parent_media_id, child_media_id)
           values ($1, $2)`,
          [pdf, page],
        );
        await root.query(
          `insert into app_public.project_medias (project_id, media_id, plugin_id)
           values ($1, $2, $3), ($1, $4, $3)`,
          [projectId, used, PLUGIN_ID, page],
        );
        const deleted: string[] = [];

        const results = await deleteSyncedMedia(
          client,
          root,
          orgId,
          [unused, used, pdf, theirs],
          async (name) => {
            deleted.push(name);
          },
        );

        expect(results).toEqual(["deleted", "inUse", "inUse", "missing"]);
        expect(deleted).toEqual([expect.stringMatching(/^unused/)]);
      },
    );
  });

  it("counts use by projects the caller cannot see", async () => {
    await asMember(async ({ client, root, orgId, otherProjectId, media }) => {
      const m = await media("shared");
      await root.query(
        `insert into app_public.project_medias (project_id, media_id, plugin_id)
         values ($1, $2, $3)`,
        [otherProjectId, m, PLUGIN_ID],
      );

      expect(
        await deleteSyncedMedia(client, root, orgId, [m], async () => {}),
      ).toEqual(["inUse"]);
    });
  });
});
