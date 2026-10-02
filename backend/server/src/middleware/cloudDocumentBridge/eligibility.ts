import { logger } from "@repo/observability";
import type { Pool } from "pg";
import type * as Y from "yjs";

import { closeBridge, openBridge } from "./registry";

/**
 * Whether our project should be bridged to the cloud.
 * Checks for cloud connection.
 */

type Eligible = {
  remoteProjectId: string;
  host: string;
  sessionCookie: string;
  expired: boolean;
};

/** The remote coordinates for a project, or null when it is local-only. */
export const lookupCloudTarget = async (
  pool: Pool,
  localProjectId: string,
): Promise<Eligible | null> => {
  const {
    rows: [row],
  } = await pool.query(
    `select p.cloud_project_id,
            cc.host,
            cc.session_cookie,
            cc.session_cookie_expiry
       from app_public.projects p
       join app_public.cloud_connections cc
         on cc.id = p.cloud_connection_id
      where p.id = $1`,
    [localProjectId],
  );

  if (!row?.cloud_project_id || !row.host || !row.session_cookie) {
    return null;
  }

  return {
    remoteProjectId: row.cloud_project_id,
    host: row.host,
    sessionCookie: row.session_cookie,
    expired:
      row.session_cookie_expiry != null &&
      new Date(row.session_cookie_expiry).getTime() <= Date.now(),
  };
};

/**
 * Bridge a project if it has somewhere to sync to.
 */
export const bridgeProjectIfEligible = async (
  pool: Pool,
  localProjectId: string,
  localDoc: Y.Doc,
): Promise<void> => {
  try {
    const target = await lookupCloudTarget(pool, localProjectId);
    if (!target) return;

    if (target.expired) {
      // Connecting with a dead cookie just produces an auth failure and a
      // reconnect loop against the remote.
      logger.warn(
        { localProjectId },
        "Skipping cloud bridge: the stored session has expired",
      );
      return;
    }

    await openBridge({
      localProjectId,
      remoteProjectId: target.remoteProjectId,
      host: target.host,
      sessionCookie: target.sessionCookie,
      localDoc,
    });
  } catch (err) {
    logger.error({ err, localProjectId }, "Failed to open the cloud bridge");
  }
};

/** Tear down the bridge for a project that is no longer loaded. */
export const unbridgeProject = async (
  localProjectId: string,
): Promise<void> => {
  await closeBridge(localProjectId);
};
