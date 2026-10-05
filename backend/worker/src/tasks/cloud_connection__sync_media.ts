import { cloud, media } from "@repo/backend-shared";
import { logger } from "@repo/observability";
import { Task, WithPgClient } from "graphile-worker";

interface CloudConnectionSyncMediaPayload {
  cloudConnectionId: string;
  /** Cloud ids of the projects on both sides after project sync. */
  externalProjectIds: string[];
  force_resync?: boolean;
  syncRunId?: string;
}

/**
 * DEBT: Currently we can't have 2 same media in the device. At least it won't be attributed to the correct organization
 * In practice, this shouldn't happen as each media should be scoped to an organization
 * But if a user were to sync between 2 organization in the same system, this would hit
 */
const task: Task = async (inPayload, { withPgClient }) => {
  const payload: CloudConnectionSyncMediaPayload = inPayload as any;
  const { cloudConnectionId, externalProjectIds, syncRunId } = payload;

  const log = logger.child({
    task: "cloud_connection__sync_media",
    cloudConnectionId,
    syncRunId,
  });
  const startedAt = Date.now();

  const setMediaStatus = async (status: "syncing" | "synced" | "failed") => {
    if (!syncRunId) return;
    try {
      await cloud.setSyncRunMediaStatus(withPgClient, syncRunId, status);
    } catch (err) {
      log.error({ err }, "Failed to update cloud sync media status");
    }
  };
  const updateRun = (sql: string, params: unknown[]) =>
    syncRunId
      ? withPgClient((pgClient) =>
          pgClient.query(sql, [syncRunId, ...params]),
        ).then(() => undefined)
      : Promise.resolve();

  log.info("Starting media sync");
  await setMediaStatus("syncing");

  // Bytes are flushed on a timer, not per chunk, so progress stays smooth
  // without hammering Postgres.
  let transferredBytes = 0;
  const flush = () =>
    updateRun(
      `update app_public.cloud_sync_runs set downloaded_bytes = $2 where id = $1`,
      [transferredBytes],
    ).catch((err) => log.error({ err }, "Failed to update transferred bytes"));
  const flushInterval = syncRunId ? setInterval(flush, 1500) : null;

  try {
    const {
      rows: [cloudConnection],
    } = await withPgClient((pgClient) =>
      pgClient.query(
        `select * from app_public.cloud_connections where id = $1`,
        [cloudConnectionId],
      ),
    );
    if (!cloudConnection?.target_organization_slug) {
      log.error("Cloud connection or its organization not found; aborting");
      await setMediaStatus("failed");
      return;
    }

    const counts = await cloud.syncMedia(withPgClient, cloudConnection, {
      mediaHandler: new media[
        process.env.STORAGE_TYPE as "file" | "s3"
      ].mediaHandler(withPgClient),
      projectIds: externalProjectIds ?? [],
      onTransfersPlanned: ({ count, bytes }) =>
        updateRun(
          `update app_public.cloud_sync_runs
           set total_media = $2, synced_media = 0,
               total_bytes = $3, downloaded_bytes = 0
           where id = $1`,
          [count, bytes],
        ),
      onBytes: (bytes) => {
        transferredBytes += bytes;
      },
      onTransferred: () =>
        updateRun(
          `update app_public.cloud_sync_runs
           set synced_media = synced_media + 1 where id = $1`,
          [],
        ),
    });

    log.info(
      { ...counts, durationMs: Date.now() - startedAt },
      "Media sync completed",
    );
    await setMediaStatus(counts.transferFailed > 0 ? "failed" : "synced");
  } catch (err) {
    log.error({ err, durationMs: Date.now() - startedAt }, "Media sync failed");
    await setMediaStatus("failed");
  } finally {
    if (flushInterval) clearInterval(flushInterval);
    await flush();
  }
};

module.exports = task;
