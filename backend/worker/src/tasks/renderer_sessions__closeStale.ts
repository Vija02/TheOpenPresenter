import { Task } from "graphile-worker";

/**
 * Closes renderer sessions whose heartbeat stopped without us ever seeing the
 * socket close (server crash, forced restart, machine powered off)
 */
const STALE_AFTER = "5 minutes";

const task: Task = async (_, { withPgClient, logger }) => {
  const { rowCount } = await withPgClient((client) =>
    client.query(
      `update app_private.renderer_sessions
       set ended_at = last_seen_at,
           end_reason = 'stale'
       where ended_at is null
         and last_seen_at < now() - interval '${STALE_AFTER}'`,
    ),
  );

  if (rowCount && rowCount > 0) {
    logger.info(`Closed ${rowCount} stale renderer session(s)`);
  }
};

export default task;
