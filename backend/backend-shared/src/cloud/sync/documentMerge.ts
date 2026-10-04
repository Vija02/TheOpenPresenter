import { logger } from "@repo/observability";
import * as Y from "yjs";

/**
 * PostGraphile exposes `bytea` as pg's hex text form (`\x0102...`), which is
 * also the form Postgres accepts back, so decoding is a straight hex parse.
 */
export const bytesFromPostgraphileBytea = (value: string): Uint8Array => {
  const hex = value.startsWith("\\x") ? value.slice(2) : value;
  return new Uint8Array(Buffer.from(hex, "hex"));
};

/**
 * Merge a remote project document into the local one instead of replacing it.
 */
export const mergeYjsDocuments = (
  local: Uint8Array | null,
  remote: Uint8Array,
): Uint8Array => {
  const doc = new Y.Doc();

  if (local && local.length > 0) {
    try {
      Y.applyUpdate(doc, local);
    } catch (err) {
      logger.warn({ err }, "Could not decode the local project document");
    }
  }

  Y.applyUpdate(doc, remote);

  return Y.encodeStateAsUpdate(doc);
};

/**
 * Whether `source` holds anything `target` does not.
 */
export const hasChangesMissingFrom = (
  source: Uint8Array,
  target: Uint8Array | null,
): boolean => {
  const doc = new Y.Doc();
  try {
    if (target) Y.applyUpdate(doc, target);
    let changed = false;
    doc.on("update", () => {
      changed = true;
    });
    Y.applyUpdate(doc, source);
    return changed;
  } finally {
    doc.destroy();
  }
};
