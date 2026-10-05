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

/**
 * The cloud reads at most 100kb per request (body-parser's default, which
 * PostGraphile keeps), so pushes are split by size as well as count.
 */
const REQUEST_BYTES = 64 * 1024;

export const inBatches = <T>(items: T[], maxCount = Infinity): T[][] => {
  const batches: T[][] = [];
  let batch: T[] = [];
  let bytes = 0;
  for (const item of items) {
    const size = Buffer.byteLength(JSON.stringify(item));
    const full = bytes + size > REQUEST_BYTES || batch.length >= maxCount;
    if (batch.length > 0 && full) {
      batches.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(item);
    bytes += size;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
};
