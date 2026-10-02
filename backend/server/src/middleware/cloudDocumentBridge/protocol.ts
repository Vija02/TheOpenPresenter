import * as Y from "yjs";

/** Mark the bridge's own writes. So we can filter and avoid loops */
export const BRIDGE_ORIGIN = Symbol.for("top.cloudBridge");

/** Is this update event the bridge seeing its own write come back? */
export function isEcho(origin: unknown): boolean {
  return origin === BRIDGE_ORIGIN;
}

export function isEmptyUpdate(update: Uint8Array): boolean {
  try {
    const { structs, ds } = Y.decodeUpdate(update);
    return structs.length === 0 && ds.clients.size === 0;
  } catch {
    return false;
  }
}
