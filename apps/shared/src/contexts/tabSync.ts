import * as Y from "yjs";

type TabSyncMessage =
  | { type: "update"; update: Uint8Array }
  /** Asks other tabs for whatever is missing from the state vector */
  | { type: "hello"; stateVector: Uint8Array; isReply: boolean };

/**
 * Keeps a document in sync with the same document open in other tabs of this
 * browser, without going through the server. So a remote can still control a
 * renderer in another tab while the connection is down
 *
 * Updates from other tabs are passed on to the server like local changes, so
 * whichever tab is still online keeps the server up to date
 */
export const syncDocAcrossTabs = (doc: Y.Doc, name: string) => {
  if (typeof BroadcastChannel === "undefined") return () => {};

  const channel = new BroadcastChannel(`yjs-tab-sync:${name}`);
  // Marks updates that came from another tab, so they aren't sent back
  const origin = Symbol("tab-sync");

  const post = (message: TabSyncMessage) => {
    try {
      channel.postMessage(message);
    } catch {
      // Channel closed
    }
  };

  const sayHello = (isReply: boolean) =>
    post({ type: "hello", stateVector: Y.encodeStateVector(doc), isReply });

  const onDocUpdate = (update: Uint8Array, updateOrigin: unknown) => {
    if (updateOrigin === origin) return;
    post({ type: "update", update });
  };

  channel.onmessage = ({ data }: MessageEvent<TabSyncMessage>) => {
    if (data.type === "update") {
      Y.applyUpdate(doc, data.update, origin);
      return;
    }
    if (data.type === "hello") {
      post({
        type: "update",
        update: Y.encodeStateAsUpdate(doc, data.stateVector),
      });
      // Get back anything we're missing too
      if (!data.isReply) sayHello(true);
    }
  };

  // Catch up after the tab was asleep
  const onVisible = () => {
    if (document.visibilityState === "visible") sayHello(false);
  };

  doc.on("update", onDocUpdate);
  document.addEventListener("visibilitychange", onVisible);
  sayHello(false);

  return () => {
    doc.off("update", onDocUpdate);
    document.removeEventListener("visibilitychange", onVisible);
    channel.close();
  };
};
