import {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
  MessageType,
} from "@hocuspocus/provider";
import type { Document } from "@hocuspocus/server";
import { cloud } from "@repo/backend-shared";
import { logger } from "@repo/observability";
import * as encoding from "lib0/encoding";
import {
  type Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
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
 *
 * Awareness is relayed too, so each side sees the other side's clients as if
 * they were connected locally. Plugins rely on this for presence-based cleanup
 * and for signaling (e.g. screen-share's WebRTC handshake). Relayed states
 * carry `bridged: true` so consumers can tell them apart from direct clients.
 */

type AwarenessChange = {
  added: number[];
  updated: number[];
  removed: number[];
};

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
  localDoc: Document;
} & BridgeEvents;

export class ProjectBridge {
  private provider: HocuspocusProvider | null = null;
  private socket: HocuspocusProviderWebsocket | null = null;
  private readonly remoteDoc = new Y.Doc();
  private detachLocal: (() => void) | null = null;
  private destroyed = false;

  private readonly localClients = new Set<number>();
  private readonly remoteClients = new Set<number>();

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
      url: cloud.websocketUrl(host),
      WebSocketPolyfill: cloud.websocketWithCookie(sessionCookie, host),
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
        this.pushLocalAwareness();
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

    const remoteAwareness = this.provider.awareness!;

    // Remote -> local awareness
    const onRemoteAwareness = (change: AwarenessChange, origin: unknown) => {
      if (this.destroyed || isEcho(origin)) return;
      const clients = changedClients(change).filter(
        (id) => id !== remoteAwareness.clientID && !this.localClients.has(id),
      );
      if (clients.length === 0) return;
      clients.forEach((id) => this.remoteClients.add(id));
      applyAwarenessUpdate(
        localDoc.awareness,
        encodeBridgedUpdate(remoteAwareness, clients),
        BRIDGE_ORIGIN,
      );
    };
    remoteAwareness.on("update", onRemoteAwareness);

    // Local -> remote awareness
    const onLocalAwareness = (change: AwarenessChange, origin: unknown) => {
      if (this.destroyed || isEcho(origin)) return;
      const clients = changedClients(change).filter(
        (id) => !this.remoteClients.has(id),
      );
      if (clients.length === 0) return;
      clients.forEach((id) => this.localClients.add(id));
      this.sendLocalAwareness(clients);
    };
    localDoc.awareness.on("update", onLocalAwareness);

    this.detachLocal = () => {
      localDoc.off("update", onLocalUpdate);
      this.remoteDoc.off("update", onRemoteUpdate);
      localDoc.awareness.off("update", onLocalAwareness);
      remoteAwareness.off("update", onRemoteAwareness);
    };
  }

  /**
   * Send local clients' awareness to the remote.
   * Note: the remote server drops relayed removals, so a local client that
   * leaves lingers there until its awareness times out (~30s).
   */
  private sendLocalAwareness(clients: number[]): void {
    if (!this.provider?.synced || !this.socket) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarString(encoder, this.options.remoteProjectId);
    encoding.writeVarUint(encoder, MessageType.Awareness);
    encoding.writeVarUint8Array(
      encoder,
      encodeBridgedUpdate(this.options.localDoc.awareness, clients),
    );
    this.socket.send(encoding.toUint8Array(encoder));
  }

  /**
   * The remote forgets our relayed clients whenever the connection drops, so
   * republish all of them on every sync.
   */
  private pushLocalAwareness(): void {
    if (this.destroyed) return;
    const clients = [
      ...this.options.localDoc.awareness.getStates().keys(),
    ].filter((id) => !this.remoteClients.has(id));
    if (clients.length === 0) return;
    clients.forEach((id) => this.localClients.add(id));
    this.sendLocalAwareness(clients);
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
    dropClients(this.options.localDoc.awareness, this.remoteClients);
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

/** Encode the given clients' states, flagged as having crossed the bridge. */
const encodeBridgedUpdate = (awareness: Awareness, clients: number[]) => {
  const states = new Map<number, Record<string, any>>();
  for (const id of clients) {
    const state = awareness.getStates().get(id);
    if (state) states.set(id, { ...state, bridged: true });
  }
  return encodeAwarenessUpdate(awareness, clients, states);
};

const changedClients = ({ added, updated, removed }: AwarenessChange) =>
  added.concat(updated, removed);

/** Remove the remote side's clients that are still present locally. */
const dropClients = (awareness: Awareness, clients: Set<number>) => {
  const present = [...clients].filter((id) => awareness.getStates().has(id));
  if (present.length > 0) {
    removeAwarenessStates(awareness, present, BRIDGE_ORIGIN);
  }
};
