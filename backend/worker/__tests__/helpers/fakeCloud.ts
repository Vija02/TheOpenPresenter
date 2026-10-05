import { Hocuspocus, WebSocketLike } from "@hocuspocus/server";
import { uuidFromMediaId } from "@repo/lib";
import { IncomingMessage, Server, ServerResponse, createServer } from "http";
import { AddressInfo } from "net";
import { WebSocketServer } from "ws";
import * as Y from "yjs";

import type {
  CloudMedia,
  LinkChange,
  MediaLink,
} from "../../../backend-shared/src/cloud/sync/media/cloud";
import {
  MediaMetadata,
  emptyMediaMetadata,
  metadataWithin,
} from "../../../backend-shared/src/cloud/sync/media/metadata";
import type { CloudSyncTable } from "../../../backend-shared/src/cloud/sync/pluginTables/introspection";
import type {
  CloudProject,
  ProjectPushChange,
} from "../../../backend-shared/src/cloud/sync/projects/cloud";

/**
 * An in-process cloud for the sync tests. Tests stage what the cloud holds;
 * pushes follow the same rules as the real cloud (cloud.ts in pluginTables/
 * and projects/), stamped with the fake's own clock, which never agrees with
 * the database's: sync must not compare the two.
 *
 * The e2e "cloud" cannot stand in: it shares the local database, where a row
 * that keeps the cloud's id cannot exist in two orgs at once.
 */

export const CLOUD_ORG_ID = "c0000000-0000-4000-8000-000000000001";

type Row = Record<string, unknown>;
export type TableChange = {
  key: Row;
  expectedUpdatedAt: string | null;
  row: Row | null;
};

/** Key order differs between Postgres jsonb and JS, so compare sorted. */
export const stableJson = (value: unknown): string =>
  JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : v,
  );
const same = (a: unknown, b: unknown) => stableJson(a) === stableJson(b);
const sameTime = (a: unknown, b: unknown) =>
  Date.parse(String(a)) === Date.parse(String(b));

export const startFakeCloud = async (syncTables: CloudSyncTable[]) => {
  let clock = Date.parse("2027-01-01T00:00:00Z");
  const fake = {
    url: "",
    now: () => new Date((clock += 1000)).toISOString(),
    /** Every GraphQL field asked for, in order. */
    requests: [] as string[],
    /** As if the session lost access to the organization. */
    orgMissing: false,
    /** As if the cloud predates sync: every sync field fails validation. */
    unsupported: false,

    // ----- @cloudSync tables -----
    tables: new Map<string, Row[]>(),
    /** Keys requested from `cloudPluginTableRows`, per entity. */
    downloaded: new Map<string, unknown[]>(),
    /** Changes received by `cloudPluginTablePush`, per entity. */
    pushed: new Map<string, TableChange[]>(),
    /** Refuse every table push, as if each row changed on the cloud. */
    rejectPushes: false,

    // ----- Projects -----
    projects: [] as CloudProject[],
    projectPushes: [] as ProjectPushChange[],
    rejectProjectPushes: false,
    /** Apply project pushes, then fail the response, as a dropped connection. */
    loseProjectResponses: false,
    /** Runs before a project push applies, e.g. to edit the cloud meanwhile. */
    beforeProjectPush: null as null | (() => unknown),
    /**
     * Reject project pushes naming a category or tag missing from
     * `tables`, as the real cloud does. Off unless the test stages those.
     */
    checkProjectReferences: false,

    // ----- Documents -----
    /** Yjs state per cloud project id. */
    documents: new Map<string, Uint8Array>(),
    /** Cloud project ids whose documents were fetched to merge. */
    documentsFetched: [] as string[],
    /** Cloud project ids whose document fetch fails. */
    failDocuments: new Set<string>(),

    // ----- Media -----
    media: [] as CloudMedia[],
    /** File contents per media name. */
    files: new Map<string, Buffer>(),
    mediaMetadata: emptyMediaMetadata(),
    mediaLinks: [] as MediaLink[],
    /** Media per page, small so tests page. */
    mediaPageSize: 2,
    /** Uploads begun but not finished, per media name: bytes so far. */
    partialUploads: new Map<string, Buffer>(),
    /** Headers of each upload's create request, per media name. */
    uploadHeaders: new Map<string, Record<string, string>>(),
    /** Bytes received by PATCH, per media name. */
    uploadedBytes: new Map<string, number>(),
    /** Media names whose download or upload fails. */
    failTransfers: new Set<string>(),
    mediaPushes: [] as { metadata: MediaMetadata; links: LinkChange[] }[],
    mediaDeletes: [] as string[],
    /** Media the cloud answers "inUse" for, as if put to use meanwhile. */
    refuseDeletes: new Set<string>(),

    close: async () => {},
  };

  const tableOf = (entity: string) =>
    syncTables.find((t) => `${t.schema}.${t.table}` === entity)!;
  const rowKey = (entity: string, row: Row) =>
    Object.fromEntries(tableOf(entity).rowKeyColumns.map((c) => [c, row[c]]));

  const applyTablePush = (entity: string, changes: TableChange[]) => {
    fake.pushed.set(entity, [...(fake.pushed.get(entity) ?? []), ...changes]);
    const rows = fake.tables.get(entity) ?? [];
    fake.tables.set(entity, rows);
    return changes.map((change) => {
      const index = rows.findIndex((r) => same(rowKey(entity, r), change.key));
      const current = rows[index];
      const stale =
        change.expectedUpdatedAt === null
          ? !!current
          : !current || !sameTime(current.updated_at, change.expectedUpdatedAt);
      if (fake.rejectPushes || stale) {
        return { status: "rejected", reason: "changed on the cloud" };
      }
      if (!change.row) {
        rows.splice(index, 1);
        dropReferencesTo(entity, current!.name as string);
        return { status: "applied", updatedAt: null };
      }
      const updatedAt = fake.now();
      const row = {
        ...change.row,
        organization_id: CLOUD_ORG_ID,
        updated_at: updatedAt,
      };
      if (current) rows[index] = row;
      else rows.push(row);
      return { status: "applied", updatedAt };
    });
  };

  /**
   * The cloud's `on delete set null` (categories) and `on delete cascade`
   * (project tags): deleting one changes every project naming it.
   */
  const dropReferencesTo = (entity: string, name: string) => {
    for (const project of fake.projects) {
      const value = project.value;
      if (entity === "app_public.categories" && value.category === name) {
        project.value = { ...value, category: null };
      } else if (entity === "app_public.tags" && value.tags.includes(name)) {
        project.value = {
          ...value,
          tags: value.tags.filter((t) => t !== name),
        };
      } else {
        continue;
      }
      project.updatedAt = fake.now();
    }
  };

  const childrenOf = (id: string): string[] =>
    fake.mediaMetadata.dependencies
      .filter((d) => d.parentMediaId === id)
      .flatMap((d) => [d.childMediaId, ...childrenOf(d.childMediaId)]);

  /** As the real cloud: deleting a media deletes all derived from it. */
  const removeMedia = (id: string) => {
    const ids = new Set([id, ...childrenOf(id)]);
    for (const m of fake.media.filter((m) => ids.has(m.id))) {
      fake.files.delete(m.mediaName);
    }
    fake.media = fake.media.filter((m) => !ids.has(m.id));
    fake.mediaLinks = fake.mediaLinks.filter((l) => !ids.has(l.mediaId));
    const md = fake.mediaMetadata;
    md.dependencies = md.dependencies.filter(
      (d) => !ids.has(d.parentMediaId) && !ids.has(d.childMediaId),
    );
    md.imageSizes = md.imageSizes.filter(
      (r) => !ids.has(r.imageMediaId) && !ids.has(r.processedMediaId),
    );
    md.imageMetadata = md.imageMetadata.filter((r) => !ids.has(r.imageMediaId));
    md.videoMetadata = md.videoMetadata.filter((r) => !ids.has(r.videoMediaId));
  };

  const mediaInUse = (id: string): boolean =>
    [id, ...childrenOf(id)].some((m) =>
      fake.mediaLinks.some((l) => l.mediaId === m),
    );

  const mediaPage = (after: string | null) => {
    const sorted = [...fake.media].sort((a, b) => (a.id < b.id ? -1 : 1));
    const page = sorted
      .filter((m) => !after || m.id > after)
      .slice(0, fake.mediaPageSize);
    const ids = new Set(page.map((m) => m.id));
    const md = fake.mediaMetadata;
    return {
      organizationId: CLOUD_ORG_ID,
      media: page,
      metadata: {
        dependencies: md.dependencies.filter((d) => ids.has(d.parentMediaId)),
        imageSizes: md.imageSizes.filter((r) => ids.has(r.imageMediaId)),
        imageMetadata: md.imageMetadata.filter((r) => ids.has(r.imageMediaId)),
        videoMetadata: md.videoMetadata.filter((r) => ids.has(r.videoMediaId)),
      },
      links: fake.mediaLinks.filter((l) => ids.has(l.mediaId)),
      endCursor:
        page.length === fake.mediaPageSize ? page[page.length - 1]!.id : null,
    };
  };

  const applyMediaPush = (metadata: MediaMetadata, links: LinkChange[]) => {
    fake.mediaPushes.push({ metadata, links });
    const known = new Set(fake.media.map((m) => m.id));
    // As writeMediaMetadata, for rows whose media the cloud has.
    const within = metadataWithin(metadata, known);
    const md = fake.mediaMetadata;
    const add = <T>(list: T[], row: T, sameKey: (a: T, b: T) => boolean) => {
      const index = list.findIndex((r) => sameKey(r, row));
      if (index >= 0) list.splice(index, 1, row);
      else list.push(row);
    };
    for (const row of within.dependencies) {
      add(md.dependencies, row, (a, b) => same(a, b));
    }
    for (const row of within.imageSizes) {
      add(
        md.imageSizes,
        row,
        (a, b) =>
          a.imageMediaId === b.imageMediaId &&
          a.width === b.width &&
          a.fileType === b.fileType,
      );
    }
    for (const row of within.imageMetadata) {
      add(md.imageMetadata, row, (a, b) => a.imageMediaId === b.imageMediaId);
    }
    for (const row of within.videoMetadata) {
      const current = md.videoMetadata.find(
        (r) => r.videoMediaId === row.videoMediaId,
      );
      const keep =
        current?.transcodeStatus === "completed" &&
        row.transcodeStatus !== "completed";
      if (!keep) {
        add(md.videoMetadata, row, (a, b) => a.videoMediaId === b.videoMediaId);
      }
    }
    return {
      metadata: { written: 0, dropped: 0 },
      links: links.map((change) => {
        const { remove, ...link } = change;
        if (remove) {
          fake.mediaLinks = fake.mediaLinks.filter((l) => !same(l, link));
          return "applied";
        }
        const projectKnown = fake.projects.some((p) => p.id === link.projectId);
        if (!projectKnown || !known.has(link.mediaId)) return "rejected";
        if (!fake.mediaLinks.some((l) => same(l, link))) {
          fake.mediaLinks.push(link);
        }
        return "applied";
      }),
    };
  };

  const applyMediaDelete = (mediaIds: string[]) =>
    mediaIds.map((id) => {
      fake.mediaDeletes.push(id);
      if (!fake.media.some((m) => m.id === id)) return "missing";
      if (fake.refuseDeletes.has(id) || mediaInUse(id)) return "inUse";
      removeMedia(id);
      return "deleted";
    });

  const missingReferences = (value: CloudProject["value"]) => {
    if (!fake.checkProjectReferences) return false;
    const names = (entity: string) =>
      new Set((fake.tables.get(entity) ?? []).map((r) => r.name));
    const categories = names("app_public.categories");
    const tags = names("app_public.tags");
    return (
      (value.category !== null && !categories.has(value.category)) ||
      value.tags.some((t) => !tags.has(t))
    );
  };

  const applyProjectPush = (changes: ProjectPushChange[]) => {
    fake.projectPushes.push(...changes);
    return changes.map((change) => {
      const rejected = (reason: string) => ({ status: "rejected", reason });
      const index = fake.projects.findIndex((p) => p.id === change.id);
      const current = fake.projects[index];
      if (fake.rejectProjectPushes) return rejected("rejected by the test");
      if (!change.expected) {
        if (current && same(current.value, change.value)) {
          return { status: "applied", updatedAt: current.updatedAt };
        }
        if (current) return rejected("already exists on the cloud");
      } else if (!current) {
        return rejected("missing on the cloud");
      } else if (!same(current.value, change.expected.value)) {
        return rejected("changed on the cloud");
      }
      if (!change.value) {
        if (!sameTime(current!.updatedAt, change.expected!.updatedAt)) {
          return rejected("changed on the cloud");
        }
        fake.projects.splice(index, 1);
        // `on delete cascade`, as on the cloud.
        fake.mediaLinks = fake.mediaLinks.filter(
          (l) => l.projectId !== change.id,
        );
        return { status: "applied", updatedAt: null };
      }
      if (missingReferences(change.value)) return rejected("missing names");
      const updatedAt = fake.now();
      const project = {
        id: change.id,
        createdAt: current?.createdAt ?? updatedAt,
        updatedAt,
        value: change.value,
      };
      if (current) fake.projects[index] = project;
      else fake.projects.push(project);
      return { status: "applied", updatedAt };
    });
  };

  const respond = (query: string, variables: Record<string, any>): object => {
    const field = query.match(/\{\s*(\w+)\s*\(/)?.[1] ?? "unknown";
    fake.requests.push(field);
    const isSyncField = field.startsWith("cloud");
    if (isSyncField && fake.unsupported) {
      return {
        errors: [{ message: `Cannot query field "${field}" on type "Query".` }],
      };
    }
    if (isSyncField && fake.orgMissing) {
      return { errors: [{ message: "Organization not found" }] };
    }
    const entity = `${variables.schemaName}.${variables.tableName}`;

    switch (field) {
      case "cloudPluginTableKeys":
        return {
          data: {
            [field]: (fake.tables.get(entity) ?? []).map((r) => ({
              key: rowKey(entity, r),
              updatedAt: r.updated_at,
            })),
          },
        };
      case "cloudPluginTableRows": {
        const wanted = new Set((variables.keys as unknown[]).map(stableJson));
        fake.downloaded.set(entity, [
          ...(fake.downloaded.get(entity) ?? []),
          ...variables.keys,
        ]);
        return {
          data: {
            [field]: (fake.tables.get(entity) ?? []).filter((r) =>
              wanted.has(stableJson(rowKey(entity, r))),
            ),
          },
        };
      }
      case "cloudPluginTablePush":
        return { data: { [field]: applyTablePush(entity, variables.changes) } };
      case "cloudProjectSyncList":
        return { data: { [field]: fake.projects } };
      case "cloudProjectSyncPush":
        return { data: { [field]: applyProjectPush(variables.changes) } };
      case "cloudMediaSyncPage":
        return { data: { [field]: mediaPage(variables.after ?? null) } };
      case "cloudMediaSyncPush":
        return {
          data: {
            [field]: applyMediaPush(variables.metadata, variables.links),
          },
        };
      case "cloudMediaSyncDelete":
        return { data: { [field]: applyMediaDelete(variables.mediaIds) } };
      case "project": {
        const id = variables.projectId as string;
        fake.documentsFetched.push(id);
        if (fake.failDocuments.has(id)) {
          return { errors: [{ message: "Document unavailable" }] };
        }
        const document = fake.documents.get(id);
        return {
          data: {
            project: {
              id,
              document: document
                ? `\\x${Buffer.from(document).toString("hex")}`
                : null,
            },
          },
        };
      }
      default:
        return { errors: [{ message: `Fake cloud has no field ${field}` }] };
    }
  };

  /**
   * The tus protocol as far as the sync client uses it, with the cloud's
   * naming: the upload of `<custom-media-id>.<file-extension>` lives at
   * `/media/upload/tus/<media name>`.
   */
  const handleTus = (
    req: IncomingMessage,
    res: ServerResponse,
    body: Buffer,
  ) => {
    const name = decodeURIComponent(
      (req.url ?? "").replace(/^\/media\/upload\/tus\/?/, ""),
    );
    const header = (h: string) => req.headers[h]?.toString() ?? "";
    res.setHeader("Tus-Resumable", "1.0.0");
    if (req.method === "POST") {
      const mediaName = `${header("custom-media-id")}.${header("file-extension")}`;
      fake.uploadHeaders.set(
        mediaName,
        Object.fromEntries(
          Object.entries(req.headers).map(([k, v]) => [k, String(v)]),
        ),
      );
      fake.partialUploads.set(mediaName, Buffer.alloc(0));
      uploadLengths.set(mediaName, Number(header("upload-length")));
      res.statusCode = 201;
      res.setHeader("Location", `/media/upload/tus/${mediaName}`);
      return res.end();
    }
    const complete = fake.files.get(name);
    const partial = fake.partialUploads.get(name);
    if (req.method === "HEAD") {
      if (!complete && !partial) {
        res.statusCode = 404;
        return res.end();
      }
      res.statusCode = 200;
      res.setHeader("Upload-Offset", String((complete ?? partial)!.length));
      return res.end();
    }
    if (req.method === "PATCH") {
      if (fake.failTransfers.has(name)) {
        res.statusCode = 500;
        return res.end();
      }
      if (!partial || Number(header("upload-offset")) !== partial.length) {
        res.statusCode = 409;
        return res.end();
      }
      const data = Buffer.concat([partial, body]);
      fake.uploadedBytes.set(
        name,
        (fake.uploadedBytes.get(name) ?? 0) + body.length,
      );
      fake.partialUploads.set(name, data);
      if (data.length === uploadLengths.get(name)) {
        fake.partialUploads.delete(name);
        fake.files.set(name, data);
        const [id, extension] = name.split(".");
        const headers = fake.uploadHeaders.get(name)!;
        fake.media.push({
          id: uuidFromMediaId(id!),
          mediaName: name,
          fileSize: String(data.length),
          originalName: Buffer.from(
            (headers["upload-metadata"] ?? "").replace(/^filename ?/, ""),
            "base64",
          ).toString(),
          fileExtension: extension!,
          isUserUploaded: headers["cloud-sync-user-uploaded"] !== "0",
        });
      }
      res.statusCode = 204;
      res.setHeader("Upload-Offset", String(data.length));
      return res.end();
    }
    res.statusCode = 405;
    res.end();
  };
  const uploadLengths = new Map<string, number>();

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", async () => {
      const raw = Buffer.concat(chunks);
      if (req.url?.startsWith("/media/upload/tus")) {
        return handleTus(req, res, raw);
      }
      if (req.url?.startsWith("/media/data/")) {
        const name = req.url.slice("/media/data/".length);
        const file = fake.files.get(name);
        res.statusCode = file && !fake.failTransfers.has(name) ? 200 : 500;
        return res.end(file);
      }
      // The cloud's GraphQL endpoint reads at most 100kb (body-parser's default).
      if (raw.length > 100 * 1024) {
        res.statusCode = 413;
        return res.end();
      }
      const { query, variables } = JSON.parse(raw.toString());
      if (query.includes("cloudProjectSyncPush")) {
        await fake.beforeProjectPush?.();
      }
      const response = respond(query, variables);
      if (fake.loseProjectResponses && query.includes("cloudProjectSyncPush")) {
        res.statusCode = 502;
        res.end();
        return;
      }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(response));
    });
  });

  // `/wlink`, as the cloud serves it: documents live in `fake.documents`, and
  // a change moves the project's `updated_at` like a save on the cloud does.
  const hocuspocus = new Hocuspocus({
    quiet: true,
    async onLoadDocument({ documentName, document }) {
      const stored = fake.documents.get(documentName);
      if (stored) Y.applyUpdate(document, stored);
      return document;
    },
    async onChange({ documentName, document }) {
      fake.documents.set(documentName, Y.encodeStateAsUpdate(document));
      const project = fake.projects.find((p) => p.id === documentName);
      if (project) project.updatedAt = fake.now();
    },
  });
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (typeof value === "string") headers.set(key, value);
      }
      const connection = hocuspocus.handleConnection(
        ws as unknown as WebSocketLike,
        new Request(url, { headers }),
      );
      ws.on("message", (data) =>
        connection.handleMessage(new Uint8Array(data as Buffer)),
      );
      ws.on("close", (code, reason) =>
        connection.handleClose({ code, reason: reason.toString() } as never),
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  fake.url = `http://localhost:${(server.address() as AddressInfo).port}`;
  fake.close = async () => {
    for (const client of wss.clients) client.terminate();
    wss.close();
    await new Promise((resolve) => server.close(resolve));
  };
  return fake;
};

export type FakeCloud = Awaited<ReturnType<typeof startFakeCloud>>;

/** Clear everything a test staged. */
export const resetFakeCloud = (fake: FakeCloud) => {
  fake.requests = [];
  fake.orgMissing = false;
  fake.unsupported = false;
  fake.tables.clear();
  fake.downloaded.clear();
  fake.pushed.clear();
  fake.rejectPushes = false;
  fake.projects = [];
  fake.projectPushes = [];
  fake.rejectProjectPushes = false;
  fake.loseProjectResponses = false;
  fake.beforeProjectPush = null;
  fake.checkProjectReferences = false;
  fake.documents.clear();
  fake.documentsFetched = [];
  fake.failDocuments.clear();
  fake.media = [];
  fake.files.clear();
  fake.mediaMetadata = emptyMediaMetadata();
  fake.mediaLinks = [];
  fake.mediaPageSize = 2;
  fake.partialUploads.clear();
  fake.uploadHeaders.clear();
  fake.uploadedBytes.clear();
  fake.failTransfers.clear();
  fake.mediaPushes = [];
  fake.mediaDeletes = [];
  fake.refuseDeletes.clear();
};
