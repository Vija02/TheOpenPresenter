import { Client, CombinedError } from "urql";

/** A cloud that predates a sync feature rejects its fields at validation. */
export class UnsupportedByCloud extends Error {}
const isUnsupportedByCloud = (err: CombinedError) =>
  err.graphQLErrors.some((e) => e.message.includes("Cannot query field"));

/** For the sync fields that are not codegen'd, since they return JSON. */
export const queryCloud = async <T>(
  urqlClient: Client,
  query: string,
  variables: Record<string, unknown>,
  kind: "query" | "mutation" = "query",
): Promise<T> => {
  const res = await urqlClient[kind](query, variables);
  if (res.error) {
    if (isUnsupportedByCloud(res.error)) throw new UnsupportedByCloud();
    throw res.error;
  }
  return res.data as T;
};
