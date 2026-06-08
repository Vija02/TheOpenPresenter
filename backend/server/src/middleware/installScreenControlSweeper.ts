import { logger } from "@repo/observability";
import { Express } from "express";

import { getShutdownActions } from "../app";
import { getRootPgPool } from "./installDatabasePools";
import { SWEEP_IDLE_UNASSIGN_SQL } from "./screenSweepQueries";

const SWEEP_INTERVAL_MS = 5_000;

export default (app: Express) => {
  const rootPgPool = getRootPgPool(app);

  let running = false;
  const tick = async () => {
    if (running) return; // prevent overlap if a tick takes >5s
    running = true;
    try {
      const unassigned = await rootPgPool.query(SWEEP_IDLE_UNASSIGN_SQL);
      if (unassigned.rowCount && unassigned.rowCount > 0) {
        logger.trace(
          { unassignedScreens: unassigned.rowCount },
          "Screen control sweeper returned idle screens to standby",
        );
      }
    } catch (err) {
      logger.warn({ err }, "Screen control sweeper failed");
    } finally {
      running = false;
    }
  };

  const handle = setInterval(tick, SWEEP_INTERVAL_MS);
  // Prevent the sweep from holding the event loop open during shutdown.
  if (typeof handle.unref === "function") handle.unref();

  const shutdownActions = getShutdownActions(app);
  shutdownActions.push(() => {
    clearInterval(handle);
  });
};
