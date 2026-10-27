import { Task } from "graphile-worker";

/**
 * Drop presence on cloud side that are lost
 */
const task: Task = async (_, { withPgClient, logger }) => {
  const { rowCount } = await withPgClient((client) =>
    client.query(
      `delete from app_private.cloud_sync_presence
       where seen_at <= now() - interval '90 seconds'`,
    ),
  );
  if (rowCount && rowCount > 0) {
    logger.debug(`Forgot ${rowCount} stale cloud sync presence(s)`);
  }
};

export default task;
