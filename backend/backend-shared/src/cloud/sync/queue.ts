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
  | "local_media_change"
  /** The cloud says something other than media changed there. */
  | "cloud_change"
  /** The cloud says media or their use in projects changed there. */
  | "cloud_media_change"
  /** Back in touch with the cloud; what changed meanwhile was missed. */
  | "reconnect";

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

const LIVE = { delayMs: 500, mode: "preserve_run_at" } as const;

const PLANS: Record<CloudSyncTrigger, Plan> = {
  // Never postpone a full sync already queued.
  start: { key: "", delayMs: 0, mode: "preserve_run_at", media: true },
  schedule: { key: "", delayMs: 0, mode: "preserve_run_at", media: true },
  manual: { key: "", delayMs: 0, mode: "replace", media: true },
  local_change: { key: ":live", ...LIVE, media: false },
  local_media_change: { key: ":media", ...LIVE, media: true },
  // Folded in with changes here: one sync covers both sides.
  cloud_change: { key: ":live", ...LIVE, media: false },
  cloud_media_change: { key: ":media", ...LIVE, media: true },
  // Could have missed media too; under the media key so a live change
  // within the delay does not replace it with one that skips media.
  reconnect: { key: ":media", ...LIVE, media: true },
};

/** Queue a sync of one cloud connection */
export const queueCloudSync = async (
  client: Queryable,
  cloudConnectionId: string,
  {
    trigger,
    forceResync,
  }: { trigger: CloudSyncTrigger; forceResync?: boolean },
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

/**
 * Sent by a studio's sync on every request to the cloud, so the cloud's
 * hints of those writes carry the studio's connection id and it ignores them.
 */
export const CLOUD_SYNC_ORIGIN_HEADER = "x-cloud-sync-origin";

// Any version: connection ids are v7.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The origin a request carries, if it is a connection id at all. */
export const cloudSyncOriginFromHeaders = (
  headers: Record<string, string | string[] | undefined>,
): string | null => {
  const origin = headers[CLOUD_SYNC_ORIGIN_HEADER];
  return typeof origin === "string" && UUID.test(origin) ? origin : null;
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
          pgClient.query(
            `select set_config('app.cloud_sync_origin', '', false)`,
          );
        await reset().catch(() => pgClient.query("rollback").then(reset));
      }
    });

// Send this so that our bridge is up to date for new projects
export const CLOUD_BRIDGE_CHANNEL = "cloud_bridge";

export const notifyBridges = async (
  withPgClient: WithPgClient,
  cloudConnectionId: string,
): Promise<void> => {
  await withPgClient((pgClient) =>
    pgClient.query("select pg_notify($1, $2)", [
      CLOUD_BRIDGE_CHANNEL,
      cloudConnectionId,
    ]),
  );
};
