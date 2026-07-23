import { useCallback, useEffect, useRef, useState } from "react";

import { useIceServers } from "../iceServers";
import { usePluginAPI } from "../pluginApi";
import {
  ViewerSignal,
  candidateKey,
  findSenderSignal,
  readSignals,
  signalFieldKey,
} from "../signaling";

type ViewerConnection = {
  sessionId: string;
  pc: RTCPeerConnection;
  addedRemoteCandidates: Set<string>;
  hasRemoteOffer: boolean;
  // Snapshot we republish to awareness.
  signalState: ViewerSignal;
};

// Kept outside React so the peer connection survives re-renders. Keyed by
// plugin instance id.
const viewerConnections: Record<string, ViewerConnection> = {};

export const useScreenShareViewer = () => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;
  const currentUserId = pluginApi.awareness.currentUserId;
  const awarenessObj = pluginApi.awareness.awarenessObj;
  const awarenessData = pluginApi.awareness.useAwarenessData();

  const isSharing = pluginApi.scene.useData((x) => x.pluginData.isSharing);
  const sessionId = pluginApi.scene.useData((x) => x.pluginData.sessionId);
  const sharerAwarenessUserId = pluginApi.scene.useData(
    (x) => x.pluginData.sharerAwarenessUserId,
  );

  const iceServersQuery = useIceServers();

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] =
    useState<RTCPeerConnectionState>("new");

  const publish = useCallback(() => {
    const conn = viewerConnections[pluginId];
    awarenessObj.setLocalStateField(
      signalFieldKey(pluginId),
      conn ? conn.signalState : null,
    );
  }, [awarenessObj, pluginId]);

  const teardown = useCallback(() => {
    const conn = viewerConnections[pluginId];
    if (conn) {
      conn.pc.close();
      delete viewerConnections[pluginId];
    }
    awarenessObj.setLocalStateField(signalFieldKey(pluginId), null);
    setRemoteStream(null);
    setConnectionState("new");
  }, [awarenessObj, pluginId]);

  useEffect(() => {
    // No active share — drop any connection and stop advertising.
    if (!isSharing || !sessionId) {
      if (viewerConnections[pluginId]) teardown();
      return;
    }

    const iceServers = iceServersQuery.data;
    if (!iceServers) return;

    // Session changed — rebuild from scratch.
    const existing = viewerConnections[pluginId];
    if (existing && existing.sessionId !== sessionId) {
      existing.pc.close();
      delete viewerConnections[pluginId];
    }

    const flushRemoteCandidates = (
      conn: ViewerConnection,
      candidates: RTCIceCandidateInit[],
    ) => {
      if (!conn.pc.remoteDescription) return;
      for (const c of candidates) {
        const key = candidateKey(c);
        if (conn.addedRemoteCandidates.has(key)) continue;
        conn.addedRemoteCandidates.add(key);
        conn.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {
          conn.addedRemoteCandidates.delete(key);
        });
      }
    };

    // Create the connection and advertise ourselves so the sender offers to us.
    let conn = viewerConnections[pluginId];
    if (!conn) {
      const pc = new RTCPeerConnection({
        iceServers: iceServers as RTCIceServer[],
      });
      const signalState: ViewerSignal = {
        role: "viewer",
        sessionId,
        candidates: [],
      };
      conn = {
        sessionId,
        pc,
        addedRemoteCandidates: new Set(),
        hasRemoteOffer: false,
        signalState,
      };
      viewerConnections[pluginId] = conn;

      pc.ontrack = (e) => {
        setRemoteStream(e.streams[0] ?? null);
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          conn!.signalState.candidates.push(e.candidate.toJSON());
          publish();
        }
      };
      pc.onconnectionstatechange = () => setConnectionState(pc.connectionState);

      publish();
    }

    // Find the sender's offer addressed to us and answer it once.
    const signals = readSignals(awarenessData, pluginId);
    const senderSignal = findSenderSignal(signals, sharerAwarenessUserId);
    const mine =
      senderSignal?.sessionId === sessionId
        ? senderSignal?.peers?.[currentUserId]
        : undefined;

    if (
      mine?.offer &&
      !conn.hasRemoteOffer &&
      conn.pc.signalingState === "stable"
    ) {
      conn.hasRemoteOffer = true;
      const c = conn;
      const senderCandidates = mine.candidates ?? [];
      c.pc
        .setRemoteDescription(mine.offer as RTCSessionDescriptionInit)
        .then(() => c.pc.createAnswer())
        .then((answer) => c.pc.setLocalDescription(answer).then(() => answer))
        .then((answer) => {
          c.signalState.answer = { type: answer.type, sdp: answer.sdp };
          publish();
          flushRemoteCandidates(c, senderCandidates);
        })
        .catch(() => {
          c.hasRemoteOffer = false;
        });
    }

    if (mine && conn.pc.remoteDescription) {
      flushRemoteCandidates(conn, mine.candidates ?? []);
    }
  }, [
    awarenessData,
    isSharing,
    sessionId,
    sharerAwarenessUserId,
    currentUserId,
    pluginId,
    iceServersQuery.data,
    publish,
    teardown,
  ]);

  // Clean up if the renderer unmounts entirely.
  const teardownRef = useRef(teardown);
  teardownRef.current = teardown;
  useEffect(() => {
    return () => {
      if (viewerConnections[pluginId]) teardownRef.current();
    };
  }, [pluginId]);

  return { isSharing, remoteStream, connectionState };
};
