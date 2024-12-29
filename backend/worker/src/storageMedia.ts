import { media } from "@repo/backend-shared";
import express from "express";
import { WithPgClient } from "graphile-worker";

export const deleteExpiredMedia = async (withPgClient: WithPgClient) => {
  await withPgClient(async (pgClient) => {
    const app = express();
    app.set("rootPgPool", pgClient);

    const dataStore =
      media[process.env.STORAGE_TYPE as "file" | "s3"].createTusStore(app);
    await dataStore.deleteExpired();
  });
};
