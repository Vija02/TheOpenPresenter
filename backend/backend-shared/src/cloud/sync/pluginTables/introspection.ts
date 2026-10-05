import type { QueryResult, QueryResultRow } from "pg";

/**
 * Plugin tables opt into cloud sync with a comment in their own migration:
 *
 *   comment on table saved_song is E'@cloudSync';
 *
 * When a row changed on both sides, the conflict strategy decides:
 *
 * - `copy`: the cloud's version wins and the local one is kept as a new row.
 *   Default when the key is a generated primary key, since a copy needs one.
 * - `cloudWins`: the cloud's version wins outright. Default otherwise, e.g.
 *   one-row-per-org settings like `bible_preference`.
 *
 * Optional tags, one per line after `@cloudSync`:
 *
 *   @cloudSyncConflict copy|cloudWins   override the default
 *   @cloudSyncCopyLabel <column>        text column suffixed on a kept copy
 */
export type ConflictStrategy = "copy" | "cloudWins";

export type CloudSyncTable = {
  schema: string;
  table: string;
  columns: string[];
  organizationColumn: string;
  /** Columns identifying the same row on both sides. */
  keyColumns: string[];
  /**
   * `keyColumns` without the organization column: what identifies a row
   * within one connection, which is one organization on each side.
   */
  rowKeyColumns: string[];
  /**
   * The primary key, when rows are matched by another key (e.g. a name).
   * Each side generates its own, so it is never compared, copied or written.
   */
  localIdentityColumns: string[];
  /** Columns referencing users. Users differ per instance, so these are cleared. */
  userColumns: string[];
  pluginReferences: PluginReference[];
  conflict: ConflictStrategy;
  copyLabelColumn: string | null;
};

export type PluginReference = {
  column: string;
  schema: string;
  table: string;
  keyColumn: string;
  organizationColumn: string;
};

export type RawCloudSyncTable = {
  schema_name: string;
  table_name: string;
  comment: string;
  columns: string[];
  /** Columns that have a default, i.e. can be generated for a copy. */
  defaulted_columns: string[];
  unique_keys: { primary: boolean; columns: string[] }[];
  foreign_keys: {
    columns: string[];
    references: string;
    referenced_columns: string[];
  }[];
};

type Queryable = {
  query<T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
};

const ORGANIZATIONS = "app_public.organizations";
const USERS = "app_public.users";

export const quoteIdent = (identifier: string): string =>
  `"${identifier.replace(/"/g, '""')}"`;
export const quoteLiteral = (value: string): string =>
  `'${value.replace(/'/g, "''")}'`;

/**
 * A row's key as jsonb, e.g. `{"id": "..."}`. Both sides build keys with this,
 * and they are compared as jsonb, so it must be the same expression on each.
 */
export const rowKeySql = (table: CloudSyncTable, alias: string): string =>
  `jsonb_build_object(${table.rowKeyColumns
    .map((c) => `${quoteLiteral(c)}, ${alias}.${quoteIdent(c)}`)
    .join(", ")})`;

/** `@name value` lines from a table comment, smart-tag style. */
const parseTags = (comment: string): Map<string, string> =>
  new Map(
    comment
      .split("\n")
      .map((line) => line.trim().match(/^@(\w+)(?:\s+(.*))?$/))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => [m[1]!, (m[2] ?? "").trim()]),
  );

/**
 * Turn a marked table into what the sync needs, or explain why it cannot be
 * synced. A marked table that would sync broken data is refused, not guessed.
 * `marked` is every marked table, to resolve references between them.
 */
export const resolveCloudSyncTable = (
  raw: RawCloudSyncTable,
  marked: RawCloudSyncTable[] = [raw],
  visiting: Set<RawCloudSyncTable> = new Set(),
): CloudSyncTable | { error: string } => {
  if (!raw.columns.includes("updated_at")) {
    return { error: "has no updated_at column" };
  }

  let organizationColumn: string | null = null;
  const userColumns: string[] = [];
  const pluginReferences: PluginReference[] = [];
  visiting.add(raw);
  for (const fk of raw.foreign_keys) {
    if (fk.references === ORGANIZATIONS && fk.columns.length === 1) {
      if (organizationColumn) {
        return { error: "references organizations more than once" };
      }
      organizationColumn = fk.columns[0]!;
    } else if (fk.references === USERS && fk.columns.length === 1) {
      userColumns.push(fk.columns[0]!);
    } else {
      const reference = resolvePluginReference(fk, marked, visiting);
      if ("error" in reference) return reference;
      pluginReferences.push(reference);
    }
  }
  visiting.delete(raw);
  if (!organizationColumn) {
    return { error: "has no foreign key to app_public.organizations" };
  }

  // Prefer a key scoped by organization: a one-row-per-org table like
  // `bible_preference` has different ids on each side, but the same org.
  // Otherwise the primary key, which is shared because rows keep cloud ids.
  const orgScoped = raw.unique_keys
    .filter((k) => k.columns.includes(organizationColumn!))
    .sort((a, b) => a.columns.length - b.columns.length)[0];
  const primary = raw.unique_keys.find((k) => k.primary);
  const key = orgScoped ?? primary;
  if (!key) {
    return { error: "has no primary key or unique constraint" };
  }

  // A copy needs its own key, which only a generated primary key can give,
  // and no other unique constraint it would collide with.
  const canCopy =
    raw.unique_keys.length === 1 &&
    key.primary &&
    key.columns.length === 1 &&
    key.columns[0] !== organizationColumn &&
    raw.defaulted_columns.includes(key.columns[0]!);

  const tags = parseTags(raw.comment);
  const requested = tags.get("cloudSyncConflict");
  if (requested && requested !== "copy" && requested !== "cloudWins") {
    return { error: `has unknown @cloudSyncConflict "${requested}"` };
  }
  const conflict: ConflictStrategy =
    (requested as ConflictStrategy | undefined) ??
    (canCopy ? "copy" : "cloudWins");
  if (conflict === "copy" && !canCopy) {
    return {
      error:
        "asks for conflict copies, but its key is not a generated primary key",
    };
  }

  const copyLabelColumn = tags.get("cloudSyncCopyLabel") || null;
  if (copyLabelColumn && !raw.columns.includes(copyLabelColumn)) {
    return { error: `has no column "${copyLabelColumn}" to label copies with` };
  }

  return {
    schema: raw.schema_name,
    table: raw.table_name,
    columns: raw.columns,
    organizationColumn,
    keyColumns: key.columns,
    rowKeyColumns: key.columns.filter((c) => c !== organizationColumn),
    localIdentityColumns: primary && primary !== key ? primary.columns : [],
    userColumns,
    pluginReferences,
    conflict,
    copyLabelColumn,
  };
};

const resolvePluginReference = (
  fk: RawCloudSyncTable["foreign_keys"][number],
  marked: RawCloudSyncTable[],
  visiting: Set<RawCloudSyncTable>,
): PluginReference | { error: string } => {
  // Ids of anything outside synced plugin tables (projects, media, unmarked
  // tables) differ between the sides, so the row would point at nothing.
  const cannot = {
    error: `references ${fk.references}, which cannot be synced by id`,
  };
  const target = marked.find(
    (t) => `${t.schema_name}.${t.table_name}` === fk.references,
  );
  if (!target || fk.columns.length !== 1) return cannot;
  if (visiting.has(target)) {
    return { error: `references ${fk.references} in a cycle` };
  }

  const resolved = resolveCloudSyncTable(target, marked, visiting);
  if ("error" in resolved) return cannot;
  // Only a primary key that is not org-scoped is the same on both sides.
  const sharedKey =
    resolved.keyColumns.length === 1 &&
    resolved.rowKeyColumns.length === 1 &&
    target.unique_keys.some(
      (k) => k.primary && k.columns.join() === resolved.keyColumns.join(),
    );
  if (
    !sharedKey ||
    fk.referenced_columns.join() !== resolved.keyColumns.join()
  ) {
    return cannot;
  }

  return {
    column: fk.columns[0]!,
    schema: resolved.schema,
    table: resolved.table,
    keyColumn: resolved.keyColumns[0]!,
    organizationColumn: resolved.organizationColumn,
  };
};

/** Referenced tables before the tables that reference them. */
const inDependencyOrder = (tables: CloudSyncTable[]): CloudSyncTable[] => {
  const ordered: CloudSyncTable[] = [];
  const visit = (table: CloudSyncTable) => {
    if (ordered.includes(table)) return;
    for (const ref of table.pluginReferences) {
      const target = tables.find(
        (t) => t.schema === ref.schema && t.table === ref.table,
      );
      // Resolution has already refused cycles.
      if (target) visit(target);
    }
    ordered.push(table);
  };
  tables.forEach(visit);
  return ordered;
};

/** Find every `@cloudSync` table across plugin schemas. */
export const introspectCloudSyncTables = async (
  client: Queryable,
): Promise<{
  tables: CloudSyncTable[];
  rejected: { schema: string; table: string; error: string }[];
}> => {
  const { rows } = await client.query<RawCloudSyncTable>(
    `
      select
        n.nspname as schema_name,
        c.relname as table_name,
        obj_description(c.oid, 'pg_class') as comment,
        array(
          -- name[] has no parser in node-postgres; text[] does.
          select a.attname::text from pg_attribute a
          where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
          order by a.attnum
        ) as columns,
        array(
          select a.attname::text from pg_attribute a
          where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
            and a.atthasdef
        ) as defaulted_columns,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'primary', i.indisprimary,
            'columns', array(
              select a.attname
              from unnest(i.indkey::int2[]) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
              order by k.ord
            )
          ))
          from pg_index i
          -- Only plain unique indexes can be an ON CONFLICT target.
          where i.indrelid = c.oid and i.indisunique
            and i.indpred is null and i.indexprs is null
        ), '[]'::jsonb) as unique_keys,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'references', rn.nspname || '.' || rc.relname,
            'referenced_columns', array(
              select a.attname
              from unnest(con.confkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum
              order by k.ord
            ),
            'columns', array(
              select a.attname
              from unnest(con.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
              order by k.ord
            )
          ))
          from pg_constraint con
          join pg_class rc on rc.oid = con.confrelid
          join pg_namespace rn on rn.oid = rc.relnamespace
          where con.conrelid = c.oid and con.contype = 'f'
        ), '[]'::jsonb) as foreign_keys
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r'
        and (n.nspname like 'plugin\\_%' or n.nspname = 'app_public')
        and obj_description(c.oid, 'pg_class') ~ '(^|\\s)@cloudSync(\\s|$)'
      order by n.nspname, c.relname
    `,
  );

  const tables: CloudSyncTable[] = [];
  const rejected: { schema: string; table: string; error: string }[] = [];
  for (const raw of rows) {
    const resolved = resolveCloudSyncTable(raw, rows);
    if ("error" in resolved) {
      rejected.push({
        schema: raw.schema_name,
        table: raw.table_name,
        error: resolved.error,
      });
    } else {
      tables.push(resolved);
    }
  }
  return { tables: inDependencyOrder(tables), rejected };
};
