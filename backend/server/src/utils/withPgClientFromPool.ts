import { WithPgClient } from "@repo/backend-shared";
import { Pool } from "pg";

export const withPgClientFromPool = (pool: Pool): WithPgClient => {
  return async (callback) => {
    const client = await pool.connect();
    try {
      return await callback(client);
    } finally {
      client.release();
    }
  };
};
