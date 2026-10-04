import {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
} from "@hocuspocus/provider";
import WebSocket from "ws";
import * as Y from "yjs";

export const websocketWithCookie = (
  cookie: string,
  origin: string,
): new (address: string | URL, protocols?: string | string[]) => WebSocket =>
  class BridgeWebSocket extends WebSocket {
    constructor(address: string | URL, protocols?: string | string[]) {
      super(address, protocols, {
        headers: {
          Cookie: cookie,
          Origin: origin,
        },
      });
    }
  };

export const websocketUrl = (host: string): string => {
  const url = new URL("/wlink", host);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};

type PushParams = {
  host: string;
  sessionCookie: string;
  remoteProjectId: string;
  update: Uint8Array;
  timeoutMs?: number;
};

/**
 * Resolves once the remote has acknowledged every update we sent.
 * We need this in case there's changes to the project locally when offline.
 * In which case then we merge and push it to the remote server.
 */
export const pushToRemoteProjectDocument = async ({
  host,
  sessionCookie,
  remoteProjectId,
  update,
  timeoutMs = 30_000,
}: PushParams): Promise<Uint8Array> => {
  const remoteDoc = new Y.Doc();
  const socket = new HocuspocusProviderWebsocket({
    url: websocketUrl(host),
    WebSocketPolyfill: websocketWithCookie(sessionCookie, host),
  });

  let provider: HocuspocusProvider | undefined;
  let timer: NodeJS.Timeout | undefined;

  try {
    await new Promise<void>((resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error("Timed out pushing the project document")),
        timeoutMs,
      );

      const resolveWhenAcknowledged = () => {
        if (provider && !provider.hasUnsyncedChanges) resolve();
      };

      provider = new HocuspocusProvider({
        websocketProvider: socket,
        name: remoteProjectId,
        document: remoteDoc,
        token: " ",
        onAuthenticationFailed: ({ reason }) => {
          reject(new Error(`Remote rejected the session: ${reason}`));
        },
        onSynced: () => {
          Y.applyUpdate(remoteDoc, update);
          resolveWhenAcknowledged();
        },
        onUnsyncedChanges: resolveWhenAcknowledged,
      });
      provider.attach();
    });

    return Y.encodeStateAsUpdate(remoteDoc);
  } finally {
    clearTimeout(timer);
    provider?.destroy();
    socket.destroy();
    remoteDoc.destroy();
  }
};
