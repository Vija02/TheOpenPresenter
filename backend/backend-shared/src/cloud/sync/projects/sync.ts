import { logger } from "@repo/observability";
import { generateSlug } from "random-word-slugs";
import { Client } from "urql";

import { WithPgClient } from "../../../types";
import { getUrqlClientFromCloudConnection } from "../../urqlClientFromCloudConnection";
import { inBatches, queryCloud } from "../cloudQuery";
import { forgetProjectLinks } from "../media/sync";
import { syncProjectDocument } from "../projectDocument";
import type {
  CloudProject,
  ProjectPushChange,
  ProjectPushResult,
} from "./cloud";
import {
  ProjectSyncValue,
  applyProjectSyncValue,
  projectSyncValueSql,
} from "./value";

// Not codegen'd: these fields return JSON.
const CLOUD_PROJECT_SYNC_LIST = `
  query CloudProjectSyncList($organizationSlug: String!) {
    cloudProjectSyncList(organizationSlug: $organizationSlug)
  }
`;
const CLOUD_PROJECT_SYNC_PUSH = `
  mutation CloudProjectSyncPush($organizationSlug: String!, $changes: JSON!) {
    cloudProjectSyncPush(organizationSlug: $organizationSlug, changes: $changes)
  }
`;

const ENTITY = "app_public.projects";
const PUSH_BATCH = 100;
// A push opens a WebSocket, so not all at once.
const DOCUMENT_SYNC_CONCURRENCY = 4;
/** Recorded instead of a timestamp to force another document merge. */
const NOT_SYNCED = "-infinity";

type CloudConnection = {
  id: string;
  host: string;
  session_cookie: string;
  organization_id: string;
  target_organization_slug: string;
  creator_user_id: string | null;
};

/**
 * One project as seen on the cloud, here, and in the state. The comparisons
 * are made in SQL: timestamps keep microseconds there, and the values compare
 * as jsonb.
 */
type Row = {
  cloud_id: string | null;
  local_id: string | null;
  local_slug: string | null;
  in_cloud: boolean;
  in_local: boolean;
  has_state: boolean;
  cloud_created_at: string | null;
  cloud_updated_at: string | null;
  local_updated_at: string | null;
  cloud_value: ProjectSyncValue | null;
  local_value: ProjectSyncValue | null;
  state_value: ProjectSyncValue | null;
  state_cloud_updated_at: string | null;
  local_matches_cloud: boolean | null;
  local_matches_state: boolean | null;
  cloud_matches_state: boolean | null;
  cloud_unchanged: boolean | null;
  local_unchanged: boolean | null;
  /** Pulled before there was state, and not edited here since. */
  legacy_untouched: boolean | null;
  /** Created here, and no push of it has been answered yet. */
  never_connected: boolean | null;
};

/** A project on both sides after this sync, to record and maybe merge. */
type Synced = {
  cloudId: string;
  localId: string;
  value: ProjectSyncValue;
  cloudUpdatedAt: string;
  localUpdatedAt: string;
  mergeDocument: boolean;
};

export type ProjectSyncCounts = {
  total: number;
  pulled: number;
  added: number;
  pushed: number;
  pushRejected: number;
  deletedLocally: number;
  /** Pulls that name a category or tag missing here; retried next sync. */
  skipped: number;
  /** Edited on both sides, and combined field by field. */
  merged: number;
  documentsSynced: number;
  documentsFailed: number;
};

type Hooks = {
  onDocumentsPlanned?: (plan: { total: number; toSync: number }) => unknown;
  onDocumentSynced?: (ok: boolean) => unknown;
};

/**
 * Two-way sync of every project in the connected organization, including ones
 * created here. Uses the same per-row state as plugin tables, keyed by the
 * cloud's project id, but detects metadata changes by content: a project's
 * `updated_at` moves with every document save.
 *
 *   both sides, metadata edited here only    -> push
 *   both sides, edited on the cloud only     -> pull
 *   both sides, edited on both               -> merge field by field, push
 *                                               and apply the result here
 *   only here, never synced                  -> create on the cloud
 *   only here, synced, untouched             -> deleted on the cloud: delete
 *   only here, synced, edited                -> edit wins: create it again
 *   only on cloud, never here                -> pull
 *   only on cloud, synced, untouched there   -> deleted here: delete
 *   only on cloud, synced, edited there      -> edit wins: pull it back
 *
 * Documents are CRDTs, so they merge instead: whenever either side's
 * `updated_at` moved since the last sync.
 *
 * Projects keep their own local id; `cloud_project_id` maps to the cloud's. A
 * project created here keeps its id on the cloud too.
 */
export const syncProjects = async (
  withPgClient: WithPgClient,
  cloudConnection: CloudConnection,
  { forceResync, ...hooks }: { forceResync: boolean } & Hooks,
): Promise<ProjectSyncCounts & { cloudProjectIds: string[] }> => {
  const urqlClient = getUrqlClientFromCloudConnection(cloudConnection);
  const organizationSlug = cloudConnection.target_organization_slug;
  const { cloudProjectSyncList: cloudProjects } = await queryCloud<{
    cloudProjectSyncList: CloudProject[];
  }>(urqlClient, CLOUD_PROJECT_SYNC_LIST, { organizationSlug });

  const rows = await compare(withPgClient, cloudConnection, cloudProjects);
  const counts: ProjectSyncCounts = {
    total: rows.length,
    pulled: 0,
    added: 0,
    pushed: 0,
    pushRejected: 0,
    deletedLocally: 0,
    skipped: 0,
    merged: 0,
    documentsSynced: 0,
    documentsFailed: 0,
  };

  const synced: Synced[] = [];
  const pulls: { row: Row; value: ProjectSyncValue }[] = [];
  const pushes: {
    row: Row;
    change: ProjectPushChange;
    /** A merge that also changes what is here, once the cloud has it. */
    applyHere?: boolean;
  }[] = [];
  const localDeletes: Row[] = [];
  const forgotten: string[] = [];

  for (const row of rows) {
    if (row.in_cloud && row.in_local) {
      // Without state, the cloud's copy of a project never connected can only
      // be its own create, whose answer was lost: what is here is newer.
      const localEditOnly = row.has_state
        ? !row.local_matches_state && row.cloud_matches_state
        : row.never_connected;
      if (row.local_matches_cloud) {
        synced.push({
          cloudId: row.cloud_id!,
          localId: row.local_id!,
          value: row.cloud_value!,
          cloudUpdatedAt: row.cloud_updated_at!,
          localUpdatedAt: row.local_updated_at!,
          mergeDocument: documentChanged(row),
        });
      } else if (localEditOnly) {
        pushes.push({
          row,
          change: {
            id: row.cloud_id!,
            expected: {
              value: row.state_value ?? row.cloud_value!,
              updatedAt: row.cloud_updated_at!,
            },
            value: row.local_value,
          },
        });
      } else if (row.has_state && !row.local_matches_state) {
        const merged = mergeValues(
          row.state_value!,
          row.local_value!,
          row.cloud_value!,
        );
        counts.merged += 1;
        if (sameValue(merged, row.cloud_value!)) {
          pulls.push({ row, value: merged });
        } else {
          pushes.push({
            row,
            change: {
              id: row.cloud_id!,
              expected: {
                value: row.cloud_value!,
                updatedAt: row.cloud_updated_at!,
              },
              value: merged,
            },
            applyHere: !sameValue(merged, row.local_value!),
          });
        }
      } else {
        // Edited on the cloud only, or no state to tell: the cloud's.
        pulls.push({ row, value: row.cloud_value! });
      }
    } else if (row.in_cloud) {
      const deletedHere =
        row.has_state && row.cloud_matches_state && row.cloud_unchanged;
      if (deletedHere) {
        pushes.push({
          row,
          change: {
            id: row.cloud_id!,
            expected: {
              value: row.state_value!,
              updatedAt: row.cloud_updated_at!,
            },
            value: null,
          },
        });
      } else {
        pulls.push({ row, value: row.cloud_value! });
      }
    } else if (row.in_local) {
      const untouched = row.has_state
        ? row.local_matches_state && row.local_unchanged
        : row.legacy_untouched;
      if (untouched) {
        localDeletes.push(row);
      } else {
        pushes.push({
          row,
          change: {
            id: row.cloud_id ?? row.local_id!,
            expected: null,
            value: row.local_value,
            slug: row.local_slug!,
          },
        });
      }
    } else {
      forgotten.push(row.cloud_id!);
    }
  }

  // Deletes the cloud made, of projects untouched here since.
  if (localDeletes.length > 0) {
    await withPgClient((pgClient) =>
      pgClient.query(`delete from app_public.projects where id = any($1)`, [
        localDeletes.map((r) => r.local_id),
      ]),
    );
    counts.deletedLocally = localDeletes.length;
    forgotten.push(...localDeletes.map((r) => r.cloud_id!));
  }

  for (const { row, value } of pulls) {
    const result = await pull(withPgClient, cloudConnection, row, value);
    if (!result) {
      counts.skipped += 1;
      continue;
    }
    counts.pulled += 1;
    if (!row.in_local) counts.added += 1;
    synced.push(result);
  }

  // A project created here takes its cloud id before the push, so a create
  // that lands but whose response is lost is recognised next time. The
  // connection is only set once it lands: that is what the bridge and the
  // document merge go by.
  const creates = pushes.filter((p) => !p.change.expected);
  await bookkeep(
    withPgClient,
    `update app_public.projects set cloud_project_id = id
     where id = any($1) and cloud_project_id is null`,
    [creates.map((p) => p.row.local_id)],
  );

  for (const batch of inBatches(pushes, PUSH_BATCH)) {
    const results = await push(
      urqlClient,
      organizationSlug,
      batch.map((p) => p.change),
    );
    for (const [index, { row, change, applyHere }] of batch.entries()) {
      const result = results[index];
      if (result?.status !== "applied") {
        counts.pushRejected += 1;
        logger.info(
          { cloudProjectId: change.id, reason: result?.reason },
          "Cloud rejected a project change; retrying next sync",
        );
        continue;
      }
      counts.pushed += 1;
      if (!change.value) {
        forgotten.push(change.id);
        continue;
      }
      if (applyHere) {
        // The cloud has the merge; until it lands here too, the next sync
        // sees both sides changed and merges again, to the same result.
        const here = await pull(
          withPgClient,
          cloudConnection,
          row,
          change.value,
        );
        if (!here) {
          counts.skipped += 1;
          continue;
        }
        synced.push({ ...here, cloudUpdatedAt: result.updatedAt! });
        continue;
      }
      synced.push({
        cloudId: change.id,
        localId: row.local_id!,
        value: change.value,
        cloudUpdatedAt: result.updatedAt!,
        localUpdatedAt: row.local_updated_at!,
        mergeDocument: true,
      });
    }
  }

  // Including projects whose create landed in an earlier sync whose response
  // was lost, and ones pulled before sync kept state.
  await bookkeep(
    withPgClient,
    `update app_public.projects set cloud_connection_id = $2
     where id = any($1) and cloud_connection_id is distinct from $2`,
    [synced.map((s) => s.localId), cloudConnection.id],
  );

  for (const s of synced) {
    s.mergeDocument ||= forceResync;
  }
  const merges = synced.filter((s) => s.mergeDocument);
  await hooks.onDocumentsPlanned?.({
    total: rows.length,
    toSync: merges.length,
  });
  const failed = new Set<string>();
  const pending = [...merges];
  const mergeNext = async (): Promise<void> => {
    const next = pending.shift();
    if (!next) return;
    try {
      await syncProjectDocument(withPgClient, next.localId);
      counts.documentsSynced += 1;
      await hooks.onDocumentSynced?.(true);
    } catch (err) {
      failed.add(next.cloudId);
      counts.documentsFailed += 1;
      logger.warn(
        { err, projectId: next.localId },
        "Failed to sync project document",
      );
      await hooks.onDocumentSynced?.(false);
    }
    return mergeNext();
  };
  await Promise.all(
    Array.from({ length: DOCUMENT_SYNC_CONCURRENCY }, mergeNext),
  );

  await record(withPgClient, cloudConnection.id, synced, failed, forgotten);
  // A project created on a side, including one copied back to a side that
  // deleted it, has none of its media links there yet: that is not their
  // removal. A project gone from both sides has no links left to sync.
  await forgetProjectLinks(withPgClient, cloudConnection.id, [
    ...forgotten,
    ...synced
      .filter(
        (s) =>
          pulls.some((p) => p.row.cloud_id === s.cloudId && !p.row.in_local) ||
          pushes.some((p) => p.change.id === s.cloudId && !p.change.expected),
      )
      .map((s) => s.cloudId),
  ]);

  return {
    ...counts,
    cloudProjectIds: synced.map((s) => s.cloudId),
  };
};

const sameValue = (a: ProjectSyncValue, b: ProjectSyncValue) =>
  a.name === b.name &&
  a.targetDate === b.targetDate &&
  a.category === b.category &&
  a.tags.join("\0") === b.tags.join("\0");

/** UTF-8 byte order, as `collate "C"` sorts on both sides. */
const byteOrder = (a: string, b: string) =>
  Buffer.compare(Buffer.from(a), Buffer.from(b));

/**
 * Three-way merge of metadata edited on both sides since `base`. Each field
 * takes whichever side changed it, the cloud's where both did; tags merge as
 * a set, so a tag added on one side and another removed on the other both
 * stick. Fields are independent, so the result is always a sensible project,
 * and e.g. a project renamed on one side while its category is renamed on the
 * other keeps both.
 */
export const mergeValues = (
  base: ProjectSyncValue,
  local: ProjectSyncValue,
  cloud: ProjectSyncValue,
): ProjectSyncValue => {
  const field = <K extends "name" | "targetDate" | "category">(key: K) =>
    local[key] !== base[key] && cloud[key] === base[key]
      ? local[key]
      : cloud[key];
  const tags = new Set(cloud.tags);
  for (const tag of local.tags) if (!base.tags.includes(tag)) tags.add(tag);
  for (const tag of base.tags) if (!local.tags.includes(tag)) tags.delete(tag);
  return {
    name: field("name"),
    targetDate: field("targetDate"),
    category: field("category"),
    tags: [...tags].sort(byteOrder),
  };
};

const documentChanged = (row: Row) =>
  !row.has_state || !row.cloud_unchanged || !row.local_unchanged;

/**
 * Sync's own columns, written without triggers so `updated_at` does not move:
 * a moved `updated_at` reads as an edit here.
 */
const bookkeep = (withPgClient: WithPgClient, sql: string, params: unknown[]) =>
  withPgClient(async (pgClient) => {
    await pgClient.query("begin");
    try {
      await pgClient.query("set local session_replication_role = replica");
      await pgClient.query(sql, params);
      await pgClient.query("commit");
    } catch (err) {
      await pgClient.query("rollback");
      throw err;
    }
  });

const compare = async (
  withPgClient: WithPgClient,
  cloudConnection: CloudConnection,
  cloudProjects: CloudProject[],
): Promise<Row[]> => {
  const { rows } = await withPgClient((pgClient) =>
    pgClient.query<Row>(
      `
        with cloud as (
          select * from jsonb_to_recordset($3::jsonb) as c(
            id uuid, "createdAt" timestamptz, "updatedAt" timestamptz,
            value jsonb
          )
        ),
        local as (
          select p.id, p.cloud_project_id, p.cloud_connection_id, p.slug,
            p.updated_at, p.cloud_last_updated,
            ${projectSyncValueSql("p")} as value
          from app_public.projects p
          where p.organization_id = $4 and not p.is_temporary
        ),
        state as (
          select (s.row_key ->> 'id')::uuid as cloud_id, s.synced_value,
            s.cloud_updated_at, s.local_updated_at
          from app_private.cloud_sync_rows s
          where s.cloud_connection_id = $1 and s.entity = $2
        )
        select
          coalesce(c.id, l.cloud_project_id, s.cloud_id) as cloud_id,
          l.id as local_id,
          l.slug::text as local_slug,
          c.id is not null as in_cloud,
          l.id is not null as in_local,
          s.cloud_id is not null as has_state,
          to_jsonb(c."createdAt") #>> '{}' as cloud_created_at,
          to_jsonb(c."updatedAt") #>> '{}' as cloud_updated_at,
          to_jsonb(l.updated_at) #>> '{}' as local_updated_at,
          c.value as cloud_value,
          l.value as local_value,
          s.synced_value as state_value,
          to_jsonb(s.cloud_updated_at) #>> '{}' as state_cloud_updated_at,
          l.value = c.value as local_matches_cloud,
          l.value = s.synced_value as local_matches_state,
          c.value = s.synced_value as cloud_matches_state,
          c."updatedAt" = s.cloud_updated_at as cloud_unchanged,
          l.updated_at = s.local_updated_at as local_unchanged,
          l.updated_at = l.cloud_last_updated as legacy_untouched,
          l.cloud_connection_id is null as never_connected
        from cloud c
        full join local l on l.cloud_project_id = c.id
        full join state s on s.cloud_id = coalesce(c.id, l.cloud_project_id)
      `,
      [
        cloudConnection.id,
        ENTITY,
        JSON.stringify(cloudProjects),
        cloudConnection.organization_id,
      ],
    ),
  );
  return rows;
};

/**
 * Write `value` here, creating the project if it is not here. Returns null,
 * changing nothing, if it names a category or tag missing here, or the project
 * changed here since it was compared: the next sync takes it from there.
 */
const pull = (
  withPgClient: WithPgClient,
  cloudConnection: CloudConnection,
  row: Row,
  value: ProjectSyncValue,
): Promise<Synced | null> =>
  withPgClient(async (pgClient) => {
    await pgClient.query("begin");
    try {
      let localId = row.local_id;
      if (localId) {
        // Hold off edits made here meanwhile, so `updated_at` read below is
        // this write's and a later edit still shows as one.
        const {
          rows: [current],
        } = await pgClient.query(
          `select ${projectSyncValueSql("p")} = $2::jsonb as unchanged
           from app_public.projects p where p.id = $1
           for update`,
          [localId, JSON.stringify(row.local_value)],
        );
        if (!current?.unchanged) {
          await pgClient.query("rollback");
          return null;
        }
      } else {
        const {
          rows: [inserted],
        } = await pgClient.query(
          `insert into app_public.projects
             (organization_id, creator_user_id, slug, name,
              cloud_connection_id, cloud_project_id)
           values ($1, $2, $3, $4, $5, $6)
           returning id`,
          [
            cloudConnection.organization_id,
            cloudConnection.creator_user_id,
            generateSlug(),
            value.name,
            cloudConnection.id,
            row.cloud_id,
          ],
        );
        localId = inserted.id;
      }

      const { missing } = await applyProjectSyncValue(
        pgClient,
        { id: localId!, organizationId: cloudConnection.organization_id },
        value,
      );
      if (missing.length > 0) {
        logger.warn(
          { cloudProjectId: row.cloud_id, missing },
          "Cloud project names categories or tags missing here; retrying next sync",
        );
        await pgClient.query("rollback");
        return null;
      }

      const {
        rows: [project],
      } = await pgClient.query(
        `update app_public.projects
         set cloud_connection_id = $2, cloud_last_updated = $3
         where id = $1
         returning to_jsonb(updated_at) #>> '{}' as updated_at`,
        [localId, cloudConnection.id, row.cloud_updated_at],
      );
      if (!row.in_local) {
        // The timestamps trigger sets `created_at` on insert; keep the cloud's.
        await pgClient.query("set local session_replication_role = replica");
        await pgClient.query(
          "update app_public.projects set created_at = $2 where id = $1",
          [localId, row.cloud_created_at],
        );
      }
      await pgClient.query("commit");
      return {
        cloudId: row.cloud_id!,
        localId: localId!,
        value,
        cloudUpdatedAt: row.cloud_updated_at!,
        localUpdatedAt: project.updated_at,
        mergeDocument: documentChanged(row),
      };
    } catch (err) {
      await pgClient.query("rollback");
      throw err;
    }
  });

const push = async (
  urqlClient: Client,
  organizationSlug: string,
  changes: ProjectPushChange[],
): Promise<ProjectPushResult[]> => {
  const { cloudProjectSyncPush } = await queryCloud<{
    cloudProjectSyncPush: ProjectPushResult[];
  }>(
    urqlClient,
    CLOUD_PROJECT_SYNC_PUSH,
    { organizationSlug, changes },
    "mutation",
  );
  return cloudProjectSyncPush;
};

/**
 * Record what both sides agree on now. A project whose document failed to
 * merge records no timestamps, so the next sync merges it again.
 */
const record = (
  withPgClient: WithPgClient,
  cloudConnectionId: string,
  synced: Synced[],
  failed: Set<string>,
  forgotten: string[],
) =>
  withPgClient(async (pgClient) => {
    await pgClient.query(
      `delete from app_private.cloud_sync_rows
       where cloud_connection_id = $1 and entity = $2
         and (row_key ->> 'id')::uuid = any($3::uuid[])`,
      [cloudConnectionId, ENTITY, forgotten],
    );
    await pgClient.query(
      `
        insert into app_private.cloud_sync_rows
          (cloud_connection_id, entity, row_key, synced_value,
           cloud_updated_at, local_updated_at)
        select $1, $2, jsonb_build_object('id', x.cloud_id), x.value,
          x.cloud_updated_at, x.local_updated_at
        from jsonb_to_recordset($3::jsonb) as x(
          cloud_id uuid, value jsonb,
          cloud_updated_at timestamptz, local_updated_at timestamptz
        )
        on conflict (cloud_connection_id, entity, row_key) do update
          set synced_value = excluded.synced_value,
              cloud_updated_at = excluded.cloud_updated_at,
              local_updated_at = excluded.local_updated_at
      `,
      [
        cloudConnectionId,
        ENTITY,
        JSON.stringify(
          synced.map((s) => {
            const merged = !failed.has(s.cloudId);
            return {
              cloud_id: s.cloudId,
              value: s.value,
              cloud_updated_at: merged ? s.cloudUpdatedAt : NOT_SYNCED,
              local_updated_at: merged ? s.localUpdatedAt : NOT_SYNCED,
            };
          }),
        ),
      ],
    );
  });
