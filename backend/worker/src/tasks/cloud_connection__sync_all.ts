import { cloud } from "@repo/backend-shared";
import { Task } from "graphile-worker";

const task: Task = async (_, { withPgClient, logger }) => {
  const ids = await withPgClient((client) =>
    cloud.queueAllCloudSyncs(client, "schedule"),
  );
  if (ids.length > 0) {
    logger.debug(`Queued scheduled cloud sync for ${ids.length} connection(s)`);
  }
};

export default task;
