import { logger } from "@repo/observability";
import { Express } from "express";

import { getShutdownActions } from "../app";
import { getRootPgPool } from "./installDatabasePools";

const SWEEP_INTERVAL_MS = 5_000;

// Delete active controllers & unassign project from screen when idle and is set to unassign
const SWEEP_IDLE_UNASSIGN_SQL = `
  with eligible as (
    select s.id as screen_id
    from app_public.screens s
    join app_public.screen_heartbeats h on h.screen_id = s.id
    where s.idle_policy = 'unassign'
      and s.current_project_id is not null
      and s.idle_after_seconds is not null
      and s.idle_after_seconds > 0
      and s.unassign_after_idle_seconds is not null
      and s.unassign_after_idle_seconds >= 0
      and greatest(
        h.last_seen_by_guest_at,
        h.last_seen_by_admin_at
      ) < now() - make_interval(
        secs => s.idle_after_seconds + s.unassign_after_idle_seconds
      )
  ),
  released_seats as (
    delete from app_public.screen_active_controllers ac
    where ac.screen_id in (select screen_id from eligible)
    returning ac.screen_id
  )
  update app_public.screens s
  set current_project_id = null
  where s.id in (select screen_id from eligible)
  returning s.id;
`;

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
