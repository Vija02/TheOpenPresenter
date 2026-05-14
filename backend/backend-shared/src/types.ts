import { PoolClient } from "pg";

export type WithPgClient = <T>(
  callback: (client: PoolClient) => Promise<T>,
) => Promise<T>;
