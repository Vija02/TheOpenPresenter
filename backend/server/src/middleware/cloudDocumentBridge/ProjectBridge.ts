import {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
} from "@hocuspocus/provider";
import { logger } from "@repo/observability";
import WebSocket from "ws";
import * as Y from "yjs";

import { BRIDGE_ORIGIN, isEcho, isEmptyUpdate } from "./protocol";

/**
 * Bridge a local project into a project yjs on a remote server.
 * Mostly use for a local installation
 *
 * The local server joins the remote document as just another Yjs client over
 * the same `/wlink` endpoint browsers use
 *
 * Updates flow both ways, tagged with `BRIDGE_ORIGIN` so an applied update is
 * recognized as an echo rather than sent straight back.
 */

export type BridgeStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "unauthorized";

export type BridgeEvents = {
  onStatus?: (status: BridgeStatus, detail?: string) => void;
};

type BridgeOptions = {
  host: string;
  sessionCookie: string;
  remoteProjectId: string;
  localDoc: Y.Doc;
} & BridgeEvents;

/**
 * `ws` accepts headers, but the provider constructs its socket with only a
 * URL. Binding the cookie into a subclass is the supported way to get one
 * onto the handshake without forking the provider.
 */
const websocketWithCookie = (cookie: string, origin: string) =>
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

const websocketUrl = (host: string): string => {
  const url = new URL("/wlink", host);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};

export class ProjectBridge {
  private provider: HocuspocusProvider | null = null;
  private socket: HocuspocusProviderWebsocket | null = null;
  private readonly remoteDoc = new Y.Doc();
  private detachLocal: (() => void) | null = null;
  private destroyed = false;

  public status: BridgeStatus = "connecting";

  constructor(private readonly options: BridgeOptions) {}

  private setStatus(status: BridgeStatus, detail?: string) {
    if (this.status === status) return;
    this.status = status;
    this.options.onStatus?.(status, detail);
  }

  start(): void {
    const { host, sessionCookie, remoteProjectId, localDoc } = this.options;

    this.socket = new HocuspocusProviderWebsocket({
      url: websocketUrl(host),
      WebSocketPolyfill: websocketWithCookie(sessionCookie, host),
    });

    this.provider = new HocuspocusProvider({
      websocketProvider: this.socket,
      name: remoteProjectId,
      document: this.remoteDoc,
      // The remote authenticates from the session cookie on the handshake;
      // this only exists because the provider insists on sending something.
      token: " ",
      onAuthenticationFailed: ({ reason }) => {
        this.setStatus("unauthorized", reason);
      },
      onStatus: ({ status }) => {
        if (status === "connected") return; // `onSynced` is the real signal.
        if (this.status === "unauthorized") return;
        this.setStatus(status === "connecting" ? "connecting" : "disconnected");
      },
      onSynced: () => {
        this.setStatus("connected");
        this.pushLocalState();
      },
      onDisconnect: () => {
        if (this.status === "unauthorized") return;
        this.setStatus("disconnected");
      },
    });

    // Supplying our own `websocketProvider` leaves the provider's
    // `manageSocket` false, and it only attaches itself when it owns the
    // socket. Without this the connection opens and then sits there: synced
    // never fires and no document is ever requested.
    this.provider.attach();

    // Remote -> local. The provider has already merged the remote side into
    // `remoteDoc`, so forwarding its updates keeps the local copy in step.
    const onRemoteUpdate = (update: Uint8Array, origin: unknown) => {
      if (this.destroyed || isEcho(origin)) return;
      Y.applyUpdate(localDoc, update, BRIDGE_ORIGIN);
    };
    this.remoteDoc.on("update", onRemoteUpdate);

    // Local -> remote.
    const onLocalUpdate = (update: Uint8Array, origin: unknown) => {
      if (this.destroyed || isEcho(origin)) return;
      Y.applyUpdate(this.remoteDoc, update, BRIDGE_ORIGIN);
    };
    localDoc.on("update", onLocalUpdate);

    this.detachLocal = () => {
      localDoc.off("update", onLocalUpdate);
      this.remoteDoc.off("update", onRemoteUpdate);
    };
  }

  /**
   * Runs on every sync, not just the first
   */
  private pushLocalState(): void {
    if (this.destroyed) return;
    const { localDoc, remoteProjectId } = this.options;

    const pending = Y.encodeStateAsUpdate(
      localDoc,
      Y.encodeStateVector(this.remoteDoc),
    );
    if (isEmptyUpdate(pending)) return;

    Y.applyUpdate(this.remoteDoc, pending, BRIDGE_ORIGIN);
    logger.info(
      { remoteProjectId, bytes: pending.byteLength },
      "Pushed local changes to the remote project",
    );
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    this.detachLocal?.();
    this.detachLocal = null;
    try {
      this.provider?.destroy();
      this.socket?.destroy();
    } catch (err) {
      logger.warn({ err }, "Error tearing down a project bridge");
    }
    this.provider = null;
    this.socket = null;
    this.remoteDoc.destroy();
  }
}
