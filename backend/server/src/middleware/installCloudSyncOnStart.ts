import { cloud } from "@repo/backend-shared";
import { logger } from "@repo/observability";
import { Express } from "express";

import { getRootPgPool } from "./installDatabasePools";

/** Sync with the cloud whenever the server starts */
export default (app: Express) => {
  cloud
    .queueAllCloudSyncs(getRootPgPool(app), "start")
    .then((ids) => {
      if (ids.length > 0) {
        logger.info({ cloudConnectionIds: ids }, "Queued cloud sync on start");
      }
    })
    .catch((err) => {
      logger.error({ err }, "Failed to queue cloud sync on start");
    });
};
