import { WithPgClient } from "../../../types";
import type { PushChange, PushResult } from "./cloud";
import { CloudSyncTable, quoteIdent, rowKeySql } from "./introspection";

/**
 * The local half of sending changes up. Both steps derive what to do from
 * `cloud_sync_rows`, so nothing needs recording at the moment of an edit:
 *
 *   no state, local row         created here      -> create on the cloud
 *   state, local row changed    edited here       -> update on the cloud
 *   state, no local row         deleted here      -> delete on the cloud
 *   state, no cloud row         deleted on cloud  -> delete here
 *
 * An edit beats a delete from the other side: the row survives, and anyone
 * who still wants it gone can delete it again.
 */

type Scope = {
  withPgClient: WithPgClient;
  cloudConnectionId: string;
  organizationId: string;
  table: CloudSyncTable;
  entity: string;
};

const targetOf = (table: CloudSyncTable) =>
  `${quoteIdent(table.schema)}.${quoteIdent(table.table)}`;

/**
 * Apply deletes the cloud made since the last sync. A row edited here since
 * then is kept, and loses its state so the push re-creates it on the cloud.
 */
export const applyCloudDeletes = async (
  { withPgClient, cloudConnectionId, organizationId, table, entity }: Scope,
  cloudKeys: { key: unknown }[],
): Promise<number> => {
  const target = targetOf(table);
  const org = quoteIdent(table.organizationColumn);
  const {
    rows: [result],
  } = await withPgClient((pgClient) =>
    pgClient.query<{ deleted: number }>(
      `
        with gone as (
          select s.row_key, s.local_updated_at
          from app_private.cloud_sync_rows s
          where s.cloud_connection_id = $1 and s.entity = $2
            and not exists (
              select 1 from jsonb_to_recordset($4::jsonb) as c(key jsonb)
              where c.key = s.row_key
            )
        ),
        deleted as (
          delete from ${target} l using gone
          where l.${org} = $3
            and ${rowKeySql(table, "l")} = gone.row_key
            and l.updated_at = gone.local_updated_at
          returning 1
        ),
        forgotten as (
          delete from app_private.cloud_sync_rows s using gone
          where s.cloud_connection_id = $1 and s.entity = $2
            and s.row_key = gone.row_key
        )
        select count(*)::int as deleted from deleted
      `,
      [cloudConnectionId, entity, organizationId, JSON.stringify(cloudKeys)],
    ),
  );
  return result!.deleted;
};

type PendingChange = {
  kind: "create" | "update" | "delete";
  row_key: Record<string, unknown>;
  row: Record<string, unknown> | null;
  /** As text, to keep Postgres' microseconds through JS. */
  local_updated_at: string | null;
  expected: string | null;
};

const PUSH_BATCH = 200;

/** Send every local change since the last sync, then record what landed. */
export const pushLocalChanges = async (
  scope: Scope,
  { deletes }: { deletes: boolean },
  send: (changes: PushChange[]) => Promise<PushResult[]>,
): Promise<{ pushed: number; rejected: number }> => {
  const { withPgClient, cloudConnectionId, organizationId, table, entity } =
    scope;
  const target = targetOf(table);
  const org = quoteIdent(table.organizationColumn);

  const { rows: all } = await withPgClient((pgClient) =>
    pgClient.query<PendingChange>(
      `
        with state as (
          select row_key, cloud_updated_at, local_updated_at
          from app_private.cloud_sync_rows
          where cloud_connection_id = $1 and entity = $2
        ),
        local as (
          select ${rowKeySql(table, "l")} as row_key, to_jsonb(l) as row,
            l.updated_at
          from ${target} l where l.${org} = $3
        )
        select 'create' as kind, local.row_key, local.row,
          to_jsonb(local.updated_at) #>> '{}' as local_updated_at,
          null as expected
        from local
        where not exists (select 1 from state where state.row_key = local.row_key)
        union all
        select 'update', local.row_key, local.row,
          to_jsonb(local.updated_at) #>> '{}',
          to_jsonb(state.cloud_updated_at) #>> '{}'
        from local join state on state.row_key = local.row_key
        where local.updated_at <> state.local_updated_at
        union all
        select 'delete', state.row_key, null, null,
          to_jsonb(state.cloud_updated_at) #>> '{}'
        from state
        where not exists (select 1 from local where local.row_key = state.row_key)
      `,
      [cloudConnectionId, entity, organizationId],
    ),
  );

  const pending = deletes ? all : all.filter((c) => c.kind !== "delete");

  let pushed = 0;
  let rejected = 0;
  for (let i = 0; i < pending.length; i += PUSH_BATCH) {
    const batch = pending.slice(i, i + PUSH_BATCH);
    const results = await send(
      batch.map((c) => ({
        key: c.row_key,
        expectedUpdatedAt: c.expected,
        row: c.row,
      })),
    );

    const landed = batch
      .map((change, index) => ({ change, result: results[index] }))
      .filter(
        (
          x,
        ): x is {
          change: PendingChange;
          result: PushResult & { status: "applied" };
        } => x.result?.status === "applied",
      );
    rejected += batch.length - landed.length;
    pushed += landed.length;
    if (landed.length === 0) continue;

    // Recorded as of what was sent: an edit made here during the push has a
    // newer `updated_at`, so the next sync still sends it.
    await withPgClient((pgClient) =>
      pgClient.query(
        `
          with landed as (
            select * from jsonb_to_recordset($3::jsonb) as x(
              row_key jsonb, deleted boolean,
              cloud_updated_at timestamptz, local_updated_at timestamptz
            )
          ),
          forgotten as (
            delete from app_private.cloud_sync_rows s using landed
            where landed.deleted
              and s.cloud_connection_id = $1 and s.entity = $2
              and s.row_key = landed.row_key
          )
          insert into app_private.cloud_sync_rows
            (cloud_connection_id, entity, row_key, cloud_updated_at, local_updated_at)
          select $1, $2, row_key, cloud_updated_at, local_updated_at
          from landed where not deleted
          on conflict (cloud_connection_id, entity, row_key) do update
            set cloud_updated_at = excluded.cloud_updated_at,
                local_updated_at = excluded.local_updated_at
        `,
        [
          cloudConnectionId,
          entity,
          JSON.stringify(
            landed.map(({ change, result }) => ({
              row_key: change.row_key,
              deleted: change.kind === "delete",
              cloud_updated_at: result.updatedAt,
              local_updated_at: change.local_updated_at,
            })),
          ),
        ],
      ),
    );
  }

  return { pushed, rejected };
};
