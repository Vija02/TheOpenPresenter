import { WithPgClient } from "../../types";

type Queryable = {
  query(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, any>[] }>;
};

export type CloudSyncTrigger =
  /** The server started. */
  | "start"
  /** Someone pressed sync. */
  | "manual"
  /** Periodic calls. */
  | "schedule"
  /** A change here to something sync covers, other than media. */
  | "local_change"
  /** A change here to media or their use in projects. */
  | "local_media_change";

export type CloudSyncPayload = {
  id: string;
  force_resync?: boolean;
  trigger?: CloudSyncTrigger;
  /** Whether to queue the media sync after. Missing means yes. */
  media?: boolean;
};

type Plan = {
  key: string;
  delayMs: number;
  mode: "replace" | "preserve_run_at";
  media: boolean;
};

const PLANS: Record<CloudSyncTrigger, Plan> = {
  // Never postpone a full sync already queued.
  start: { key: "", delayMs: 0, mode: "preserve_run_at", media: true },
  schedule: { key: "", delayMs: 0, mode: "preserve_run_at", media: true },
  manual: { key: "", delayMs: 0, mode: "replace", media: true },
  // Each change pushes the run back, so a burst of edits is one sync.
  local_change: { key: ":live", delayMs: 2000, mode: "replace", media: false },
  // Media sync pages every media and moves files; wait longer.
  local_media_change: {
    key: ":media",
    delayMs: 10000,
    mode: "replace",
    media: true,
  },
};

/** Queue a sync of one cloud connection */
export const queueCloudSync = async (
  client: Queryable,
  cloudConnectionId: string,
  { trigger, forceResync }: { trigger: CloudSyncTrigger; forceResync?: boolean },
): Promise<void> => {
  const plan = PLANS[trigger];
  const payload: CloudSyncPayload = {
    id: cloudConnectionId,
    trigger,
    media: plan.media,
    ...(forceResync ? { force_resync: true } : {}),
  };
  await client.query(
    `select graphile_worker.add_job(
       'cloud_connection__sync',
       $1::json,
       queue_name := $2,
       run_at := now() + $3 * interval '1 millisecond',
       job_key := $4,
       job_key_mode := $5
     )`,
    [
      JSON.stringify(payload),
      `cloud_sync:${cloudConnectionId}`,
      plan.delayMs,
      `cloud_connection__sync:${cloudConnectionId}${plan.key}`,
      plan.mode,
    ],
  );
};

/** Queue a sync for every organization */
export const queueAllCloudSyncs = async (
  client: Queryable,
  trigger: "start" | "schedule",
): Promise<string[]> => {
  const { rows } = await client.query(
    `select id from app_public.cloud_connections
     where target_organization_slug is not null
       and session_cookie_expiry > now()`,
  );
  for (const { id } of rows) {
    await queueCloudSync(client, id, { trigger });
  }
  return rows.map((r) => r.id);
};

export const withCloudSyncOrigin =
  (withPgClient: WithPgClient, cloudConnectionId: string): WithPgClient =>
  (callback) =>
    withPgClient(async (pgClient) => {
      await pgClient.query(
        `select set_config('app.cloud_sync_origin', $1, false)`,
        [cloudConnectionId],
      );
      try {
        return await callback(pgClient);
      } finally {
        const reset = () =>
          pgClient.query(`select set_config('app.cloud_sync_origin', '', false)`);
        await reset().catch(() => pgClient.query("rollback").then(reset));
      }
    });
