import { WithPgClient } from "../../types";

export type MediaPhaseStatus = "syncing" | "synced" | "failed";

export const createSyncRun = async (
  withPgClient: WithPgClient,
  params: {
    organizationId: string;
    cloudConnectionId: string;
    forceResync: boolean;
  },
): Promise<string> => {
  const {
    rows: [row],
  } = await withPgClient((pgClient) =>
    pgClient.query(
      `
        INSERT INTO app_public.cloud_sync_runs
          (organization_id, cloud_connection_id, status, force_resync, started_at)
        VALUES ($1, $2, 'in_progress', $3, now())
        RETURNING id
      `,
      [params.organizationId, params.cloudConnectionId, params.forceResync],
    ),
  );
  return row.id;
};

export const setSyncRunProjectTargets = async (
  withPgClient: WithPgClient,
  runId: string,
  targets: { total: number; toSync: number },
): Promise<void> => {
  await withPgClient((pgClient) =>
    pgClient.query(
      `
        UPDATE app_public.cloud_sync_runs
          SET total_projects = $2, projects_to_sync = $3
          WHERE id = $1
      `,
      [runId, targets.total, targets.toSync],
    ),
  );
};

/** Increment the count of projects fully synced so far (atomic). */
export const bumpSyncRunSyncedProjects = async (
  withPgClient: WithPgClient,
  runId: string,
  by: number = 1,
): Promise<void> => {
  await withPgClient((pgClient) =>
    pgClient.query(
      `
        UPDATE app_public.cloud_sync_runs
          SET synced_projects = synced_projects + $2
          WHERE id = $1
      `,
      [runId, by],
    ),
  );
};

/** Increment the count of projects that failed to sync (atomic). */
export const bumpSyncRunFailedProjects = async (
  withPgClient: WithPgClient,
  runId: string,
  by: number = 1,
): Promise<void> => {
  await withPgClient((pgClient) =>
    pgClient.query(
      `
        UPDATE app_public.cloud_sync_runs
          SET failed_projects = failed_projects + $2
          WHERE id = $1
      `,
      [runId, by],
    ),
  );
};

/**
 * Mark the project phase complete. `status` reflects the project phase only
 * (categories, tags, meta, documents): 'failed' if any project failed to sync,
 * otherwise 'completed'. The media phase tracks itself via `media_status`.
 */
export const completeSyncRunProjects = async (
  withPgClient: WithPgClient,
  runId: string,
): Promise<void> => {
  await withPgClient((pgClient) =>
    pgClient.query(
      `
        UPDATE app_public.cloud_sync_runs
          SET status = CASE
                WHEN failed_projects > 0
                  THEN 'failed'::app_public.cloud_sync_run_status
                ELSE 'completed'::app_public.cloud_sync_run_status
              END
          WHERE id = $1
      `,
      [runId],
    ),
  );
};

export const setSyncRunDeletions = async (
  withPgClient: WithPgClient,
  runId: string,
  count: number,
): Promise<void> => {
  await withPgClient((pgClient) =>
    pgClient.query(
      `
        UPDATE app_public.cloud_sync_runs
          SET projects_to_delete = $2, deleted_projects = $2
          WHERE id = $1
      `,
      [runId, count],
    ),
  );
};

/** Mark a run failed */
export const failSyncRun = async (
  withPgClient: WithPgClient,
  runId: string,
  error: unknown,
): Promise<void> => {
  await withPgClient((pgClient) =>
    pgClient.query(
      `
        UPDATE app_public.cloud_sync_runs
          SET status = 'failed', media_status = 'failed',
              error = $2, completed_at = now()
          WHERE id = $1 AND status <> 'completed'
      `,
      [runId, error instanceof Error ? error.message : String(error)],
    ),
  );
};

/**
 * Update the media phase status (tracked independently from the project phase
 * `status`). `completed_at` marks the overall run end since media is the last
 * phase to finish
 */
export const setSyncRunMediaStatus = async (
  withPgClient: WithPgClient,
  runId: string,
  status: MediaPhaseStatus,
): Promise<void> => {
  await withPgClient((pgClient) =>
    pgClient.query(
      `
        UPDATE app_public.cloud_sync_runs
          SET media_status = $2::app_public.cloud_sync_item_status,
              completed_at = CASE
                WHEN $2 IN ('synced', 'failed') THEN now()
                ELSE completed_at
              END
          WHERE id = $1
      `,
      [runId, status],
    ),
  );
};
