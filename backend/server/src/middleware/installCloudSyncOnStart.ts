import { logger } from "@repo/observability";
import { Express } from "express";
import { WorkerUtils } from "graphile-worker";
import { Pool } from "pg";

import { getRootPgPool } from "./installDatabasePools";
import { getWorkerUtils } from "./installWorkerUtils";

/** Queue a sync for every connected organization. */
export const queueCloudSyncs = async (
  rootPgPool: Pool,
  workerUtils: WorkerUtils,
): Promise<string[]> => {
  const { rows } = await rootPgPool.query<{ id: string }>(
    `select id from app_public.cloud_connections
     where target_organization_slug is not null
       and session_cookie_expiry > now()`,
  );
  for (const { id } of rows) {
    await workerUtils.addJob(
      "cloud_connection__sync",
      { id },
      { jobKey: `cloud_connection__sync:${id}`, jobKeyMode: "preserve_run_at" },
    );
  }
  return rows.map((r) => r.id);
};

/** Sync with the cloud whenever the server starts */
export default (app: Express) => {
  queueCloudSyncs(getRootPgPool(app), getWorkerUtils(app))
    .then((ids) => {
      if (ids.length > 0) {
        logger.info({ cloudConnectionIds: ids }, "Queued cloud sync on start");
      }
    })
    .catch((err) => {
      logger.error({ err }, "Failed to queue cloud sync on start");
    });
};
