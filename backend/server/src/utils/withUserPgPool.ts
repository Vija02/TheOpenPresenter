import { Express } from "express";
import { PoolClient } from "pg";

import { getAuthPgPool } from "../middleware/installDatabasePools";

export const withUserPgPool = async <T extends any>(
  app: Express,
  sessionId: string,
  fn: (client: PoolClient) => Promise<T> | T,
): Promise<T> => {
  const authPgPool = getAuthPgPool(app);

  const client = await authPgPool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `select set_config('role', $1::text, true), set_config('jwt.claims.session_id', $2::text, true)`,
      [process.env.DATABASE_VISITOR, sessionId],
    );
    const res = await fn(client);

    await client.query("COMMIT");

    return res;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};
