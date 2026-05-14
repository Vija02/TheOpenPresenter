import { job, media } from "@repo/backend-shared";
import { Task } from "graphile-worker";

/**
 * Worker task that deletes multiple media files in batch.
 * Continues even if some deletions fail (logs errors but doesn't throw).
 */
const task: Task = async (inPayload, { withPgClient, logger }) => {
  const payload: job.DeleteBatchPayload = inPayload as any;
  const { mediaNames, __completionKey } = payload;

  let deletedCount = 0;
  let failedCount = 0;

  try {
    logger.info(`Starting batch delete of ${mediaNames.length} media files`);

    const mediaHandler = new media[
      process.env.STORAGE_TYPE as "file" | "s3"
    ].mediaHandler(withPgClient);

    for (const mediaName of mediaNames) {
      try {
        await mediaHandler.deleteMedia(mediaName);
        deletedCount++;
        logger.debug(`Deleted media: ${mediaName}`);
      } catch (err) {
        failedCount++;
        logger.warn(`Failed to delete media: ${mediaName}`);
        // Continue with other deletions
      }
    }

    logger.info(
      `Batch delete completed: ${deletedCount} deleted, ${failedCount} failed`,
    );

    const result: job.DeleteBatchResult = {
      deletedCount,
      failedCount,
    };

    await job.notifyJobSuccess(withPgClient, __completionKey, result);
  } catch (error: any) {
    logger.error(`Batch delete failed: ${error.message}`);
    await job.notifyJobFailure(
      withPgClient,
      __completionKey,
      error.message || "Unknown error",
    );
    throw error;
  }
};

export default task;
