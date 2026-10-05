import type { QueryResult, QueryResultRow } from "pg";

import { CloudSyncTable, quoteIdent, rowKeySql } from "./introspection";

/**
 * The cloud's side of plugin table sync. Every function runs on the caller's
 * own connection, so the plugin table's RLS decides what they may read and
 * write.
 */

type Queryable = {
  query<T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
};

export type PushChange = {
  key: Record<string, unknown>;
  /** The cloud `updated_at` the change was based on; null to create. */
  expectedUpdatedAt: string | null;
  /** The full local row; null to delete. */
  row: Record<string, unknown> | null;
};

export type PushResult =
  | { status: "applied"; updatedAt: string | null }
  | { status: "rejected"; reason: string };

const targetOf = (table: CloudSyncTable) =>
  `${quoteIdent(table.schema)}.${quoteIdent(table.table)}`;

/**
 * Refuse an organization the caller cannot see. Answering with no rows would
 * read, on the other side, as "the cloud deleted everything".
 */
export const findCloudOrganizationId = async (
  client: Queryable,
  slug: string,
): Promise<string> => {
  const {
    rows: [org],
  } = await client.query<{ id: string }>(
    "select id from app_public.organizations where slug = $1",
    [slug],
  );
  if (!org) throw new Error("Organization not found");
  return org.id;
};

export const listCloudRowKeys = async (
  client: Queryable,
  table: CloudSyncTable,
  organizationId: string,
): Promise<{ key: unknown; updatedAt: string }[]> => {
  const {
    rows: [row],
  } = await client.query<{ keys: { key: unknown; updatedAt: string }[] }>(
    `
      select coalesce(jsonb_agg(jsonb_build_object(
        'key', ${rowKeySql(table, "t")},
        'updatedAt', t.updated_at
      )), '[]'::jsonb) as keys
      from ${targetOf(table)} t
      where t.${quoteIdent(table.organizationColumn)} = $1
    `,
    [organizationId],
  );
  return row!.keys;
};

export const listCloudRows = async (
  client: Queryable,
  table: CloudSyncTable,
  organizationId: string,
  keys: unknown[],
): Promise<Record<string, unknown>[]> => {
  const {
    rows: [row],
  } = await client.query<{ rows: Record<string, unknown>[] }>(
    `
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as rows
      from ${targetOf(table)} t
      where t.${quoteIdent(table.organizationColumn)} = $1
        and ${rowKeySql(table, "t")} in (select jsonb_array_elements($2::jsonb))
    `,
    [organizationId, JSON.stringify(keys)],
  );
  return row!.rows;
};

/**
 * Apply local changes, each only if the cloud row is still the one the change
 * was based on. Anything else is rejected and left for the next pull to
 * resolve, so no two clocks are ever compared.
 *
 * Must run inside a transaction: each change gets a savepoint, so one bad row
 * (e.g. referencing a row the cloud lacks) rejects only itself.
 */
export const applyPushedChanges = async (
  client: Queryable,
  table: CloudSyncTable,
  organizationId: string,
  userId: string | null,
  changes: PushChange[],
): Promise<PushResult[]> => {
  const writable = await writableColumns(client, targetOf(table));
  const results: PushResult[] = [];
  for (const change of changes) {
    await client.query("savepoint cloud_sync_push");
    try {
      results.push(
        await applyOne(client, table, organizationId, userId, writable, change),
      );
      await client.query("release savepoint cloud_sync_push");
    } catch (err) {
      await client.query("rollback to savepoint cloud_sync_push");
      results.push({
        status: "rejected",
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
};

const applyOne = async (
  client: Queryable,
  table: CloudSyncTable,
  organizationId: string,
  userId: string | null,
  { insertable, updatable }: Awaited<ReturnType<typeof writableColumns>>,
  change: PushChange,
): Promise<PushResult> => {
  const target = targetOf(table);
  const org = quoteIdent(table.organizationColumn);
  const match = `t.${org} = $1 and ${rowKeySql(table, "t")} = $2::jsonb`;
  const params = [organizationId, JSON.stringify(change.key)];

  const {
    rows: [current],
  } = await client.query<{ matches: boolean | null }>(
    `select t.updated_at = $3::timestamptz as matches
     from ${target} t where ${match} for update`,
    [...params, change.expectedUpdatedAt],
  );
  if (change.expectedUpdatedAt === null ? current : !current?.matches) {
    return {
      status: "rejected",
      reason: current ? "changed on the cloud" : "missing on the cloud",
    };
  }

  if (!change.row) {
    await client.query(`delete from ${target} t where ${match}`, params);
    return { status: "applied", updatedAt: null };
  }

  // The org, user references and local identity are this side's own; never
  // take them from the other instance.
  const userColumns = new Set(table.userColumns);
  const columns = Object.keys(change.row).filter(
    (c) =>
      table.columns.includes(c) &&
      c !== table.organizationColumn &&
      !userColumns.has(c) &&
      !table.localIdentityColumns.includes(c),
  );
  const row: Record<string, unknown> = {};
  for (const c of columns) row[c] = change.row[c];

  if (!current) {
    row[table.organizationColumn] = organizationId;
    for (const c of userColumns) row[c] = userId;
    // Columns the caller may not set (e.g. timestamps under column grants)
    // fall back to their defaults and triggers.
    const insertColumns = Object.keys(row)
      .filter((c) => insertable.has(c))
      .map(quoteIdent)
      .join(", ");
    const {
      rows: [inserted],
    } = await client.query<{ updated_at: string }>(
      `insert into ${target} (${insertColumns})
       select ${insertColumns} from jsonb_populate_record(null::${target}, $1)
       returning to_jsonb(updated_at) #>> '{}' as updated_at`,
      [JSON.stringify(row)],
    );
    return { status: "applied", updatedAt: inserted!.updated_at };
  }

  const updateColumns = columns.filter(
    (c) =>
      updatable.has(c) &&
      !table.keyColumns.includes(c) &&
      c !== "created_at" &&
      c !== "updated_at",
  );
  // Set explicitly for tables without a timestamps trigger, so other
  // instances still see the change. Where the caller cannot, the table's
  // trigger owns it.
  const set = [
    ...updateColumns.map((c) => `${quoteIdent(c)} = r.${quoteIdent(c)}`),
    ...(updatable.has("updated_at") ? ["updated_at = now()"] : []),
  ].join(", ");
  const {
    rows: [updated],
  } = await client.query<{ updated_at: string }>(
    `update ${target} t set ${set}
     from jsonb_populate_record(null::${target}, $3) r
     where ${match}
     returning to_jsonb(t.updated_at) #>> '{}' as updated_at`,
    [...params, JSON.stringify(row)],
  );
  return { status: "applied", updatedAt: updated!.updated_at };
};

/** What the caller may write, which column-level grants can narrow. */
const writableColumns = async (client: Queryable, target: string) => {
  const { rows } = await client.query<{
    column: string;
    can_insert: boolean;
    can_update: boolean;
  }>(
    `select a.attname::text as column,
       has_column_privilege(a.attrelid, a.attnum, 'INSERT') as can_insert,
       has_column_privilege(a.attrelid, a.attnum, 'UPDATE') as can_update
     from pg_attribute a
     where a.attrelid = $1::regclass and a.attnum > 0 and not a.attisdropped`,
    [target],
  );
  return {
    insertable: new Set(rows.filter((r) => r.can_insert).map((r) => r.column)),
    updatable: new Set(rows.filter((r) => r.can_update).map((r) => r.column)),
  };
};
