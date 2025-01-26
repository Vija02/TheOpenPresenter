import { media } from "@repo/backend-shared";
import { WithPgClient } from "graphile-worker";

export const deleteExpiredMedia = async (withPgClient: WithPgClient) => {
  await withPgClient(async (pgClient) => {
    const dataStore =
      media[process.env.STORAGE_TYPE as "file" | "s3"].createTusStore(pgClient);
    await dataStore.deleteExpired();
  });
};
