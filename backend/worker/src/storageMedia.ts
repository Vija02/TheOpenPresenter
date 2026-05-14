import { WithPgClient, media } from "@repo/backend-shared";

export const deleteExpiredMedia = async (withPgClient: WithPgClient) => {
  const dataStore = media[
    process.env.STORAGE_TYPE as "file" | "s3"
  ].createTusStore(withPgClient);
  await dataStore.deleteExpired();
};
