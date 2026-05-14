import { PoolClient } from "pg";

import { WithPgClient } from "../types";

export const withTransaction = async <T>(
  withPgClient: WithPgClient,
  fn: (client: PoolClient, txWithPgClient: WithPgClient) => Promise<T>,
): Promise<T> => {
  return withPgClient(async (client) => {
    await client.query("BEGIN");
    try {
      const txWithPgClient: WithPgClient = (cb) => cb(client);
      const result = await fn(client, txWithPgClient);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Swallow rollback errors so we surface the original failure.
      }
      throw err;
    }
  });
};
