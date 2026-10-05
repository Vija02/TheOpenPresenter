import { Hocuspocus, WebSocketLike } from "@hocuspocus/server";
import { Server, createServer } from "http";
import { AddressInfo } from "net";
import { WebSocketServer } from "ws";
import * as Y from "yjs";

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

  const server: Server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      // The cloud's GraphQL endpoint reads at most 100kb (body-parser's default).
      if (Buffer.byteLength(body) > 100 * 1024) {
        res.statusCode = 413;
        return res.end();
      }
      const { query, variables } = JSON.parse(body);
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
};
