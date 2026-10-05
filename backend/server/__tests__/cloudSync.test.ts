import express from "express";
import { ExecutionResult, GraphQLSchema, graphql } from "graphql";
import { Server } from "http";
import { AddressInfo } from "net";
import { Pool } from "pg";
import {
  PostGraphileOptions,
  createPostGraphileSchema,
  withPostGraphileContext,
} from "postgraphile";
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
  createSession,
  createUsers,
  deleteTestUsers,
} from "../../__tests__/helpers";

// Media go to a file store in a temporary directory, read when it loads.
const { uploads, previousEnv } = vi.hoisted(() => {
  const dir = require("fs").mkdtempSync(
    require("path").join(require("os").tmpdir(), "cloud-sync-server-"),
  );
  const previousEnv = {
    STORAGE_TYPE: process.env.STORAGE_TYPE,
    STORAGE_PROXY: process.env.STORAGE_PROXY,
    UPLOADS_PATH: process.env.UPLOADS_PATH,
  };
  process.env.STORAGE_TYPE = "file";
  process.env.STORAGE_PROXY = "local";
  process.env.UPLOADS_PATH = dir;
  return { uploads: dir, previousEnv };
});

// The server imports the package, whose `dist` may be stale; test the source.
vi.mock(
  "@repo/backend-shared",
  async () => await import("../../backend-shared/src"),
);

/**
 * The cloud's sync endpoints as connected instances call them: each GraphQL
 * field through the real schema as a logged-in user, and media uploads
 * through the real tus middleware with the sync client. Writes are committed,
 * so each test cleans up by organization.
 */

const ORG_PREFIX = "testcloudsyncserver";
const PLUGIN_ID = "b1000000-0000-4000-8000-000000000001";

let pool: Pool;
let schema: GraphQLSchema;
let options: PostGraphileOptions;
let orgId: string;
let orgSlug: string;
let sessionId: string;

const query = async (text: string, params: unknown[] = []) =>
  (await pool.query(text, params)).rows;

/** Run a GraphQL operation as the logged-in user, and commit it. */
const asUser = async (
  source: string,
  variables: Record<string, unknown>,
): Promise<ExecutionResult<Record<string, any>>> => {
  const req: any = { user: { session_id: sessionId }, headers: {} };
  const pgSettings = await (options.pgSettings as any)(req);
  return withPostGraphileContext(
    { ...options, pgPool: pool, pgSettings, pgForceTransaction: true },
    async (context: any) => {
      const extra = await options.additionalGraphQLContextFromRequest!(
        req,
        {} as any,
      );
      const result = await graphql({
        schema,
        source,
        contextValue: { ...context, ...extra },
        variableValues: variables,
      });
      await context.pgClient.query(result.errors ? "rollback" : "commit");
      return result;
    },
  );
};

/** As `asUser`, expecting success; returns the field's value. */
const call = async (
  field: string,
  source: string,
  variables: Record<string, unknown>,
) => {
  const result = await asUser(source, variables);
  expect(result.errors).toBeUndefined();
  return result.data![field];
};

beforeAll(async () => {
  pool = new Pool({ connectionString: TEST_DATABASE_URL });
  const { getPostGraphileOptions } = await import("../src/graphile.config");
  options = getPostGraphileOptions({ rootPgPool: pool });
  schema = await createPostGraphileSchema(pool, "app_public", options);
});

afterAll(async () => {
  await pool.end();
  require("fs").rmSync(uploads, { recursive: true, force: true });
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(async () => {
  orgSlug = `${ORG_PREFIX}-${Date.now()}`;
  [{ id: orgId }] = await query(
    `insert into app_public.organizations (slug, name)
     values ($1, 'Cloud') returning id`,
    [orgSlug],
  );
  const [user] = await createUsers(pool, 1, true);
  await query(
    `insert into app_public.organization_memberships (organization_id, user_id, is_owner)
     values ($1, $2, true)`,
    [orgId, user!.id],
  );
  sessionId = (await createSession(pool, user!.id)).uuid;
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

describe("GraphQL", () => {
  const PROJECT_LIST = `query ($s: String!) { cloudProjectSyncList(organizationSlug: $s) }`;
  const PROJECT_PUSH = `mutation ($s: String!, $c: JSON!) { cloudProjectSyncPush(organizationSlug: $s, changes: $c) }`;

  it("refuses an organization the user is not a member of", async () => {
    await query(
      `insert into app_public.organizations (slug, name) values ($1, 'Other')`,
      [`${orgSlug}-other`],
    );

    for (const source of [
      `query ($s: String!) { cloudProjectSyncList(organizationSlug: $s) }`,
      `query ($s: String!) { cloudMediaSyncPage(organizationSlug: $s) }`,
      `query ($s: String!) { cloudPluginTableKeys(organizationSlug: $s, schemaName: "app_public", tableName: "tags") }`,
    ]) {
      const result = await asUser(source, { s: `${orgSlug}-other` });
      expect(result.errors?.[0]?.message).toBe("Organization not found");
    }
  });

  it("pushes and lists projects", async () => {
    const id = "9a000000-0000-4000-8000-0000000000aa";
    const value = {
      name: "Easter",
      targetDate: null,
      category: null,
      tags: [],
    };

    const [created] = await call("cloudProjectSyncPush", PROJECT_PUSH, {
      s: orgSlug,
      c: [{ id, expected: null, value, slug: "easter" }],
    });

    expect(created).toMatchObject({ status: "applied" });
    expect(
      await call("cloudProjectSyncList", PROJECT_LIST, { s: orgSlug }),
    ).toEqual([
      {
        id,
        createdAt: expect.any(String),
        updatedAt: created.updatedAt,
        value,
      },
    ]);
  });

  it("pushes and lists @cloudSync table rows", async () => {
    const PUSH = `mutation ($s: String!, $c: JSON!) {
      cloudPluginTablePush(organizationSlug: $s, schemaName: "app_public", tableName: "categories", changes: $c)
    }`;
    const KEYS = `query ($s: String!) {
      cloudPluginTableKeys(organizationSlug: $s, schemaName: "app_public", tableName: "categories")
    }`;
    await query(
      "delete from app_public.categories where organization_id = $1",
      [orgId],
    );

    const [pushed] = await call("cloudPluginTablePush", PUSH, {
      s: orgSlug,
      c: [
        {
          key: { name: "Youth" },
          expectedUpdatedAt: null,
          row: { id: "ca700000-0000-4000-8000-000000000001", name: "Youth" },
        },
      ],
    });

    expect(pushed).toMatchObject({ status: "applied" });
    expect(await call("cloudPluginTableKeys", KEYS, { s: orgSlug })).toEqual([
      { key: { name: "Youth" }, updatedAt: expect.any(String) },
    ]);
  });

  describe("media", () => {
    const PAGE = `query ($s: String!) { cloudMediaSyncPage(organizationSlug: $s) }`;
    const PUSH = `mutation ($s: String!, $m: JSON!, $l: JSON!) {
      cloudMediaSyncPush(organizationSlug: $s, metadata: $m, links: $l)
    }`;
    const DELETE = `mutation ($s: String!, $ids: JSON!) {
      cloudMediaSyncDelete(organizationSlug: $s, mediaIds: $ids)
    }`;

    const storeMedia = async (content: string) => {
      const { media } = await import("@repo/backend-shared");
      const handler = new media.file.mediaHandler(async (callback) => {
        const client = await pool.connect();
        try {
          return await callback(client);
        } finally {
          client.release();
        }
      });
      const mediaId = typeidUnboxed("media");
      await handler.uploadMedia({
        file: Readable.from(Buffer.from(content)),
        fileExtension: "bin",
        fileSize: content.length,
        userId: null,
        organizationId: orgId,
        mediaId,
        skipProcessing: true,
      });
      const [{ id }] = await query(
        "select id from app_public.medias where media_name = $1",
        [`${mediaId}.bin`],
      );
      return { id: id as string, mediaName: `${mediaId}.bin` };
    };

    it("lists, takes metadata and links, and deletes only unused media", async () => {
      const used = await storeMedia("used");
      const unused = await storeMedia("unused");
      const [{ id: projectId }] = await query(
        `insert into app_public.projects (organization_id, slug, name)
         values ($1, 'p', 'P') returning id`,
        [orgId],
      );

      const page = await call("cloudMediaSyncPage", PAGE, { s: orgSlug });
      expect(page.organizationId).toBe(orgId);
      expect(page.media.map((m: any) => m.id).sort()).toEqual(
        [used.id, unused.id].sort(),
      );

      const pushed = await call("cloudMediaSyncPush", PUSH, {
        s: orgSlug,
        m: { imageMetadata: [{ imageMediaId: used.id, width: 2, height: 3 }] },
        l: [
          { projectId, mediaId: used.id, pluginId: PLUGIN_ID, remove: false },
        ],
      });
      expect(pushed).toEqual({
        metadata: { written: 1, dropped: 0 },
        links: ["applied"],
      });

      expect(
        await call("cloudMediaSyncDelete", DELETE, {
          s: orgSlug,
          ids: [used.id, unused.id],
        }),
      ).toEqual(["inUse", "deleted"]);
      expect(
        await query(
          "select id from app_public.medias where organization_id = $1",
          [orgId],
        ),
      ).toEqual([{ id: used.id }]);
      expect(require("fs").existsSync(`${uploads}/${unused.mediaName}`)).toBe(
        false,
      );
    });
  });
});

describe("tus uploads from the sync client", () => {
  let server: Server;
  let host: string;

  beforeAll(async () => {
    const app = express();
    app.set("rootPgPool", pool);
    app.set("authPgPool", pool);
    // Stands in for the session middleware: the cookie is the session.
    app.use((req: any, _res, next) => {
      const session = /session=([^;]+)/.exec(req.headers.cookie ?? "")?.[1];
      req.user = session ? { session_id: session } : undefined;
      next();
    });
    const { default: installFileUpload } = await import(
      "../src/middleware/installFileUpload"
    );
    installFileUpload(app);
    server = app.listen(0);
    host = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const upload = async (content: string, isUserUploaded: boolean) => {
    const { cloud } = await import("@repo/backend-shared");
    const mediaName = `${typeidUnboxed("media")}.jpg`;
    await cloud.uploadMedia({
      host,
      sessionCookie: `session=${sessionId}`,
      cloudOrganizationId: orgId,
      media: {
        id: "",
        media_name: mediaName,
        file_size: String(content.length),
        original_name: "original.jpg",
        is_user_uploaded: isUserUploaded,
      },
      read: async () => Readable.from(Buffer.from(content)),
      onBytes: () => {},
    });
    return mediaName;
  };

  const stored = async (mediaName: string) => {
    const [row] = await query(
      `select is_complete, is_user_uploaded, original_name, organization_id,
         (select count(*)::int from app_public.media_image_metadata i
          where i.image_media_id = m.id) as image_metadata
       from app_public.medias m where media_name = $1`,
      [mediaName],
    );
    const file = require("fs").readFileSync(`${uploads}/${mediaName}`, "utf8");
    return { ...row, file };
  };

  it("stores the file under its own id, as it was, without processing it", async () => {
    // Not a real image: processing it would fail the upload.
    const mediaName = await upload("not really a jpg", false);

    expect(await stored(mediaName)).toEqual({
      is_complete: true,
      is_user_uploaded: false,
      original_name: "original.jpg",
      organization_id: orgId,
      image_metadata: 0,
      file: "not really a jpg",
    });
  });

  it("keeps a user upload a user upload", async () => {
    const mediaName = await upload("user's", true);

    expect(await stored(mediaName)).toMatchObject({ is_user_uploaded: true });
  });

  it("resumes an interrupted upload, and skips a finished one", async () => {
    const mediaName = `${typeidUnboxed("media")}.jpg`;
    const [mediaId] = mediaName.split(".");
    const headers = {
      "Tus-Resumable": "1.0.0",
      Cookie: `session=${sessionId}`,
      "organization-id": orgId,
      "custom-media-id": mediaId!,
      "file-extension": "jpg",
      "cloud-sync": "1",
    };
    // The first four bytes landed before the connection dropped.
    const created = await fetch(`${host}/media/upload/tus`, {
      method: "POST",
      headers: { ...headers, "Upload-Length": "10" },
    });
    expect(created.status).toBe(201);
    const patched = await fetch(`${host}/media/upload/tus/${mediaName}`, {
      method: "PATCH",
      headers: {
        ...headers,
        "Upload-Offset": "0",
        "Content-Type": "application/offset+octet-stream",
      },
      body: "abcd",
    });
    expect(patched.status).toBe(204);

    const { cloud } = await import("@repo/backend-shared");
    const sent: number[] = [];
    const resume = () =>
      cloud.uploadMedia({
        host,
        sessionCookie: `session=${sessionId}`,
        cloudOrganizationId: orgId,
        media: {
          id: "",
          media_name: mediaName,
          file_size: "10",
          original_name: null,
          is_user_uploaded: false,
        },
        read: async () => Readable.from(Buffer.from("abcdefghij")),
        onBytes: (n) => sent.push(n),
      });

    await resume();
    expect(sent).toEqual([6]);
    expect((await stored(mediaName)).file).toBe("abcdefghij");

    await resume();
    expect(sent).toEqual([6]);
  });

  it("refuses an organization the user is not a member of", async () => {
    const [{ id: otherOrg }] = await query(
      `insert into app_public.organizations (slug, name)
       values ($1, 'Other') returning id`,
      [`${orgSlug}-other`],
    );
    const { cloud } = await import("@repo/backend-shared");

    await expect(
      cloud.uploadMedia({
        host,
        sessionCookie: `session=${sessionId}`,
        cloudOrganizationId: otherOrg,
        media: {
          id: "",
          media_name: `${typeidUnboxed("media")}.jpg`,
          file_size: "1",
          original_name: null,
          is_user_uploaded: true,
        },
        read: async () => Readable.from(Buffer.from("x")),
        onBytes: () => {},
      }),
    ).rejects.toThrow(/Creating upload/);
  });
});
