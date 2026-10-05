import { logger } from "@repo/observability";
import { Client, CombinedError } from "urql";

import { WithPgClient } from "../../types";
import { getUrqlClientFromCloudConnection } from "../urqlClientFromCloudConnection";
import {
  CloudSyncTable,
  introspectCloudSyncTables,
  quoteIdent,
  quoteLiteral,
  rowKeySql,
} from "./pluginTableIntrospection";

// Not codegen'd: these fields return plugin rows as untyped JSON.
const CLOUD_PLUGIN_TABLE_KEYS = `
  query CloudPluginTableKeys($organizationSlug: String!, $schemaName: String!, $tableName: String!) {
    cloudPluginTableKeys(organizationSlug: $organizationSlug, schemaName: $schemaName, tableName: $tableName)
  }
`;
const CLOUD_PLUGIN_TABLE_ROWS = `
  query CloudPluginTableRows($organizationSlug: String!, $schemaName: String!, $tableName: String!, $keys: JSON!) {
    cloudPluginTableRows(organizationSlug: $organizationSlug, schemaName: $schemaName, tableName: $tableName, keys: $keys)
  }
`;

const ROWS_PER_REQUEST = 200;

const CONFLICT_COPY_SUFFIX = " (conflicted copy)";

type CloudConnection = {
  id: string;
  host: string;
  session_cookie: string;
  organization_id: string;
  target_organization_slug: string;
};

type Ctx = {
  withPgClient: WithPgClient;
  urqlClient: Client;
  cloudConnection: CloudConnection;
  table: CloudSyncTable;
  entity: string;
};

type Counts = {
  pulled: number;
  conflicts: number;
  deletedOnCloud: number;
};

/** A cloud that predates plugin sync rejects the fields at validation. */
class UnsupportedByCloud extends Error {}
const isUnsupportedByCloud = (err: CombinedError) =>
  err.graphQLErrors.some((e) => e.message.includes("Cannot query field"));

/**
 * Pull every `@cloudSync` plugin table from the cloud.
 *
 * Pull-only: local changes are not sent up, and cloud deletes are counted but
 * not applied. Per-row state in `app_private.cloud_sync_rows` means only rows
 * changed on the cloud are downloaded, a row edited only locally is left
 * alone, and a row edited on both sides goes to the table's conflict strategy.
 *
 * Rows keep the cloud's primary key, since project documents refer to plugin
 * rows by id.
 */
export const syncPluginTables = async (
  withPgClient: WithPgClient,
  cloudConnection: CloudConnection,
  { forceResync }: { forceResync: boolean },
): Promise<Counts & { failedTables: number }> => {
  const { tables, rejected } = await withPgClient((pgClient) =>
    introspectCloudSyncTables(pgClient),
  );
  for (const { schema, table, error } of rejected) {
    logger.warn(
      { schemaName: schema, tableName: table },
      `Plugin table is marked @cloudSync but ${error}; not syncing it`,
    );
  }

  const urqlClient = getUrqlClientFromCloudConnection(cloudConnection);
  const total = { pulled: 0, conflicts: 0, deletedOnCloud: 0, failedTables: 0 };

  for (const table of tables) {
    const entity = `${table.schema}.${table.table}`;
    const log = logger.child({ entity });
    try {
      const counts = await syncCloudPluginTable(
        { withPgClient, urqlClient, cloudConnection, table, entity },
        { forceResync },
      );
      total.pulled += counts.pulled;
      total.conflicts += counts.conflicts;
      total.deletedOnCloud += counts.deletedOnCloud;
      log.debug(counts, "Synced plugin table");
    } catch (err) {
      if (err instanceof UnsupportedByCloud) {
        log.info("Cloud does not support plugin table sync; skipping");
        break;
      }
      log.warn({ err }, "Failed to sync plugin table");
      total.failedTables += 1;
    }
  }

  return total;
};

const queryCloud = async <T>(
  urqlClient: Client,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const res = await urqlClient.query(query, variables);
  if (res.error) {
    if (isUnsupportedByCloud(res.error)) throw new UnsupportedByCloud();
    throw res.error;
  }
  return res.data as T;
};

const syncCloudPluginTable = async (
  ctx: Ctx,
  { forceResync }: { forceResync: boolean },
): Promise<Counts> => {
  const { withPgClient, urqlClient, cloudConnection, table, entity } = ctx;
  const cloudVariables = {
    organizationSlug: cloudConnection.target_organization_slug,
    schemaName: table.schema,
    tableName: table.table,
  };

  const { cloudPluginTableKeys: cloudKeys } = await queryCloud<{
    cloudPluginTableKeys: { key: unknown; updatedAt: string }[];
  }>(urqlClient, CLOUD_PLUGIN_TABLE_KEYS, cloudVariables);

  // Compared in Postgres so the cloud's timestamps keep full precision.
  const {
    rows: [diff],
  } = await withPgClient((pgClient) =>
    pgClient.query<{ changed: unknown[]; deleted_on_cloud: number }>(
      `
        with cloud as (
          select * from jsonb_to_recordset($1::jsonb) as k(key jsonb, "updatedAt" timestamptz)
        ),
        state as (
          select * from app_private.cloud_sync_rows
          where cloud_connection_id = $2 and entity = $3
        )
        select
          coalesce((
            select jsonb_agg(cloud.key) from cloud
            left join state on state.row_key = cloud.key
            where $4 or state.row_key is null
              or state.cloud_updated_at <> cloud."updatedAt"
          ), '[]'::jsonb) as changed,
          (
            select count(*)::int from state
            where not exists (select 1 from cloud where cloud.key = state.row_key)
          ) as deleted_on_cloud
      `,
      [JSON.stringify(cloudKeys), cloudConnection.id, entity, forceResync],
    ),
  );

  const counts: Counts = {
    pulled: 0,
    conflicts: 0,
    deletedOnCloud: diff!.deleted_on_cloud,
  };
  for (let i = 0; i < diff!.changed.length; i += ROWS_PER_REQUEST) {
    const keys = diff!.changed.slice(i, i + ROWS_PER_REQUEST);
    const { cloudPluginTableRows: rows } = await queryCloud<{
      cloudPluginTableRows: Record<string, unknown>[];
    }>(urqlClient, CLOUD_PLUGIN_TABLE_ROWS, { ...cloudVariables, keys });
    if (rows.length === 0) continue;

    const applied = await applyCloudPluginRows(ctx, rows);
    counts.pulled += applied.pulled;
    counts.conflicts += applied.conflicts;
  }
  return counts;
};

type Action = "insert" | "same" | "overwrite" | "conflict";

const applyCloudPluginRows = async (
  { withPgClient, cloudConnection, table, entity }: Ctx,
  cloudRows: Record<string, unknown>[],
): Promise<{ pulled: number; conflicts: number }> => {
  // The cloud may run a newer plugin version with columns we lack; only write
  // what exists here, and let local defaults fill the rest.
  const columns = Object.keys(cloudRows[0]!).filter((c) =>
    table.columns.includes(c),
  );
  const userColumns = new Set(table.userColumns);
  const incoming = cloudRows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const column of columns) {
      out[column] = userColumns.has(column) ? null : row[column];
    }
    out[table.organizationColumn] = cloudConnection.organization_id;
    return out;
  });

  const target = `${quoteIdent(table.schema)}.${quoteIdent(table.table)}`;
  const org = quoteIdent(table.organizationColumn);
  // Always within this org: with shared ids, the same id can exist under
  // another local org that syncs the same cloud org.
  const keyMatch = [table.organizationColumn, ...table.rowKeyColumns]
    .map((c) => `l.${quoteIdent(c)} = c.${quoteIdent(c)}`)
    .join(" and ");
  // Compared to tell a real edit from a no-op. Org, user references and
  // timestamps always differ between the sides, so they are left out.
  const contentColumns = columns.filter(
    (c) =>
      c !== table.organizationColumn &&
      !userColumns.has(c) &&
      c !== "created_at" &&
      c !== "updated_at",
  );
  const content = (alias: string) =>
    contentColumns.length === 0
      ? `'{}'::jsonb`
      : `jsonb_build_object(${contentColumns
          .map((c) => `${quoteLiteral(c)}, ${alias}.${quoteIdent(c)}`)
          .join(", ")})`;
  const incomingRows = `
    jsonb_array_elements($1::jsonb) with ordinality as e(r, idx)
    cross join lateral jsonb_populate_record(null::${target}, e.r) c
  `;
  // Rows pointing at a row this org does not have (not pulled, or deleted
  // here) are skipped rather than failing the batch on the foreign key.
  const referencesPresent =
    table.pluginReferences
      .map((ref) => {
        const column = `c.${quoteIdent(ref.column)}`;
        return `(${column} is null or exists (
          select 1 from ${quoteIdent(ref.schema)}.${quoteIdent(ref.table)} r
          where r.${quoteIdent(ref.keyColumn)} = ${column}
            and r.${quoteIdent(ref.organizationColumn)} = c.${org}
        ))`;
      })
      .join(" and ") || "true";

  return withPgClient(async (pgClient) => {
    await pgClient.query("BEGIN");
    try {
      const params = [JSON.stringify(incoming), cloudConnection.id, entity];

      // Lock first, so a local edit cannot land between classifying and writing.
      await pgClient.query(
        `select 1 from ${incomingRows} join ${target} l on ${keyMatch} for update of l`,
        [params[0]],
      );

      const { rows: classified } = await pgClient.query<{
        idx: string;
        action: Action;
        local_id: string | null;
      }>(
        `
          select e.idx,
            case
              when l.${org} is null then 'insert'
              when ${content("l")} = ${content("c")} then 'same'
              -- Untouched locally since the last sync.
              when s.row_key is not null
                and l.updated_at = s.local_updated_at then 'overwrite'
              -- Edited on both sides, or differing with no sync on record.
              else 'conflict'
            end as action,
            ${table.conflict === "copy" ? `l.${quoteIdent(table.keyColumns[0]!)}::text` : "null"} as local_id
          from ${incomingRows}
          left join ${target} l on ${keyMatch}
          left join app_private.cloud_sync_rows s
            on s.cloud_connection_id = $2 and s.entity = $3
            and s.row_key = ${rowKeySql(table, "c")}
          where ${referencesPresent}
        `,
        params,
      );

      const conflicts = classified.filter((x) => x.action === "conflict");
      if (table.conflict === "copy" && conflicts.length > 0) {
        await keepLocalCopies(
          pgClient,
          table,
          target,
          conflicts.map((x) => x.local_id!),
        );
      }

      // The cloud's version takes the row under both strategies; `copy` has
      // already kept the local one.
      const toWrite = classified
        .filter((x) => x.action !== "same")
        .map((x) => incoming[Number(x.idx) - 1]!);
      if (toWrite.length > 0) {
        await upsert(pgClient, table, target, columns, toWrite);
      }

      // Read back after the write, so the pull's own write to `updated_at` is
      // not later mistaken for a local edit.
      await pgClient.query(
        `
          insert into app_private.cloud_sync_rows
            (cloud_connection_id, entity, row_key, cloud_updated_at, local_updated_at)
          select $2, $3, ${rowKeySql(table, "c")}, (e.r->>'updated_at')::timestamptz, l.updated_at
          from ${incomingRows}
          join ${target} l on ${keyMatch}
          on conflict (cloud_connection_id, entity, row_key) do update
            set cloud_updated_at = excluded.cloud_updated_at,
                local_updated_at = excluded.local_updated_at
        `,
        params,
      );

      await pgClient.query("COMMIT");
      return { pulled: toWrite.length, conflicts: conflicts.length };
    } catch (err) {
      await pgClient.query("ROLLBACK");
      throw err;
    }
  });
};

/** Keep the local side of each conflict as a new row with a fresh key. */
const keepLocalCopies = async (
  pgClient: Parameters<Parameters<WithPgClient>[0]>[0],
  table: CloudSyncTable,
  target: string,
  localIds: string[],
) => {
  const keyColumn = table.keyColumns[0]!;
  // Left to defaults: a new key, and trigger-stamped timestamps.
  const copyColumns = table.columns.filter(
    (c) => c !== keyColumn && c !== "created_at" && c !== "updated_at",
  );
  const select = copyColumns.map((c) =>
    c === table.copyLabelColumn
      ? `${quoteIdent(c)} || ${quoteLiteral(CONFLICT_COPY_SUFFIX)}`
      : quoteIdent(c),
  );
  await pgClient.query(
    `
      insert into ${target} (${copyColumns.map(quoteIdent).join(", ")})
      select ${select.join(", ")} from ${target}
      where ${quoteIdent(keyColumn)}::text = any($1)
    `,
    [localIds],
  );
};

const upsert = async (
  pgClient: Parameters<Parameters<WithPgClient>[0]>[0],
  table: CloudSyncTable,
  target: string,
  columns: string[],
  rows: Record<string, unknown>[],
) => {
  const org = quoteIdent(table.organizationColumn);
  const columnList = columns.map(quoteIdent).join(", ");
  // User references are cleared on insert, but an existing row keeps its own:
  // they point at this instance's users.
  const updateColumns = columns.filter(
    (c) => !table.keyColumns.includes(c) && !table.userColumns.includes(c),
  );
  const onConflict =
    updateColumns.length === 0
      ? "do nothing"
      : `do update set ${updateColumns
          .map((c) => `${quoteIdent(c)} = excluded.${quoteIdent(c)}`)
          .join(", ")}
        -- A row with this id in another local org means two local orgs
        -- share one cloud org. Never move rows between them.
        where existing.${org} = excluded.${org}`;

  // Triggers run on purpose: `updated_at` takes the local clock, and plugins'
  // change notifications refresh open documents.
  await pgClient.query(
    `
      insert into ${target} as existing (${columnList})
      select ${columnList} from jsonb_populate_recordset(null::${target}, $1)
      on conflict (${table.keyColumns.map(quoteIdent).join(", ")}) ${onConflict}
    `,
    [JSON.stringify(rows)],
  );
};
