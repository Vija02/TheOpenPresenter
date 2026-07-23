import { useCallback, useEffect, useRef, useState } from "react";

import { useIceServers } from "../iceServers";
import { usePluginAPI } from "../pluginApi";
import {
  SenderSignal,
  candidateKey,
  findViewerSignals,
  readSignals,
  signalFieldKey,
} from "../signaling";
import {
  SenderPeer,
  randomSessionId,
  senderSessions,
} from "./senderSession";

export type ViewerState = {
  userId: string;
  connectionState: RTCPeerConnectionState;
  type?: "remote" | "renderer";
};

export const useScreenShareSender = () => {
  const pluginApi = usePluginAPI();
  const pluginId = pluginApi.pluginContext.pluginId;
  const currentUserId = pluginApi.awareness.currentUserId;
  const awarenessObj = pluginApi.awareness.awarenessObj;
  const awarenessData = pluginApi.awareness.useAwarenessData();

  const mutableSceneData = pluginApi.scene.useValtioData();
  const isSharing = pluginApi.scene.useData((x) => x.pluginData.isSharing);
  const sessionId = pluginApi.scene.useData((x) => x.pluginData.sessionId);
  const sharerAwarenessUserId = pluginApi.scene.useData(
    (x) => x.pluginData.sharerAwarenessUserId,
  );

  const iceServersQuery = useIceServers();

  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [viewerStates, setViewerStates] = useState<ViewerState[]>([]);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const isSharer = isSharing && sharerAwarenessUserId === currentUserId;
  const sharedByOther = isSharing && sharerAwarenessUserId !== currentUserId;

  const publish = useCallback(() => {
    const session = senderSessions[pluginId];
    awarenessObj.setLocalStateField(
      signalFieldKey(pluginId),
      session ? session.signalState : null,
    );
  }, [awarenessObj, pluginId]);

  const updateViewerStates = useCallback(() => {
    const session = senderSessions[pluginId];
    if (!session) {
      setViewerStates([]);
      return;
    }
    setViewerStates(
      Object.entries(session.peers).map(([userId, peer]) => ({
        userId,
        connectionState: peer.pc.connectionState,
        type: peer.type,
      })),
    );
  }, [pluginId]);

  // Tear down our own capture and stop advertising
  const localTeardown = useCallback(() => {
    const session = senderSessions[pluginId];
    if (session) {
      Object.values(session.peers).forEach((p) => p.pc.close());
      session.stream.getTracks().forEach((t) => t.stop());
      delete senderSessions[pluginId];
    }
    setPreviewStream(null);
    setViewerStates([]);
    awarenessObj.setLocalStateField(signalFieldKey(pluginId), null);
  }, [awarenessObj, pluginId]);

  const stopShare = useCallback(() => {
    localTeardown();
    // Clear the shared state only if we still own it
    if (mutableSceneData.pluginData.sharerAwarenessUserId === currentUserId) {
      mutableSceneData.pluginData.isSharing = false;
      mutableSceneData.pluginData.sharerAwarenessUserId = null;
      mutableSceneData.pluginData.sessionId = null;
    }
  }, [localTeardown, mutableSceneData, currentUserId]);

  // Stop the current share even if another operator owns it
  const stopSharedScreen = useCallback(() => {
    localTeardown();
    mutableSceneData.pluginData.isSharing = false;
    mutableSceneData.pluginData.sharerAwarenessUserId = null;
    mutableSceneData.pluginData.sessionId = null;
  }, [localTeardown, mutableSceneData]);

  const startShare = useCallback(async () => {
    setCaptureError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
    } catch (err) {
      setCaptureError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Screen capture was cancelled or blocked."
          : "Could not start screen capture.",
      );
      return;
    }

    const newSessionId = randomSessionId();
    const signalState: SenderSignal = {
      role: "sender",
      sessionId: newSessionId,
      peers: {},
    };
    senderSessions[pluginId] = {
      sessionId: newSessionId,
      stream,
      peers: {},
      signalState,
    };
    setPreviewStream(stream);

    // The browser's own "Stop sharing" control ends the track.
    stream.getVideoTracks().forEach((t) => {
      t.addEventListener("ended", () => stopShare());
    });

    // Announce over awareness first, then flip the shared state. Writing a new
    // sessionId + our own id is what overrides any operator already sharing.
    publish();
    mutableSceneData.pluginData.isSharing = true;
    mutableSceneData.pluginData.sharerAwarenessUserId = currentUserId;
    mutableSceneData.pluginData.sessionId = newSessionId;
  }, [currentUserId, mutableSceneData, pluginId, publish, stopShare]);

  // We hold a capture but are no longer the active sharer (overridden, session
  // changed, or sharing stopped). Drop it without clobbering the new owner.
  useEffect(() => {
    const session = senderSessions[pluginId];
    if (!session) return;
    const stillOwner =
      isSharing &&
      sharerAwarenessUserId === currentUserId &&
      sessionId === session.sessionId;
    if (!stillOwner) {
      localTeardown();
    }
  }, [
    isSharing,
    sharerAwarenessUserId,
    sessionId,
    currentUserId,
    pluginId,
    localTeardown,
  ]);

  // One peer connection per viewer, reconciled against the awareness channel
  useEffect(() => {
    if (!isSharer) return;
    const session = senderSessions[pluginId];
    if (!session || session.sessionId !== sessionId) return;
    const iceServers = iceServersQuery.data;
    if (!iceServers) return;

    const flushRemoteCandidates = (
      peer: SenderPeer,
      candidates: RTCIceCandidateInit[],
    ) => {
      if (!peer.pc.remoteDescription) return;
      for (const c of candidates) {
        const key = candidateKey(c);
        if (peer.addedRemoteCandidates.has(key)) continue;
        peer.addedRemoteCandidates.add(key);
        peer.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {
          peer.addedRemoteCandidates.delete(key);
        });
      }
    };

    const signals = readSignals(awarenessData, pluginId);
    const viewers = findViewerSignals(signals, session.sessionId);
    const viewerIds = new Set(viewers.map((v) => v.userId));

    for (const { userId: viewerId, type, signal } of viewers) {
      let peer = session.peers[viewerId];

      if (!peer) {
        const pc = new RTCPeerConnection({
          iceServers: iceServers as RTCIceServer[],
        });
        peer = {
          pc,
          addedRemoteCandidates: new Set(),
          hasRemoteAnswer: false,
          type,
        };
        session.peers[viewerId] = peer;
        session.signalState.peers[viewerId] = { candidates: [] };

        session.stream
          .getTracks()
          .forEach((t) => pc.addTrack(t, session.stream));

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            session.signalState.peers[viewerId]!.candidates.push(
              e.candidate.toJSON(),
            );
            publish();
          }
        };
        pc.onconnectionstatechange = () => updateViewerStates();

        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer).then(() => offer))
          .then((offer) => {
            session.signalState.peers[viewerId]!.offer = {
              type: offer.type,
              sdp: offer.sdp,
            };
            publish();
          })
          .catch(() => {
            /* offer failed; retried on the next reconcile */
          });
      } else if (peer.type === undefined && type !== undefined) {
        peer.type = type;
      }

      // Apply the viewer's answer once.
      if (
        signal.answer &&
        !peer.hasRemoteAnswer &&
        peer.pc.signalingState === "have-local-offer"
      ) {
        peer.hasRemoteAnswer = true;
        const currentPeer = peer;
        peer.pc
          .setRemoteDescription(signal.answer as RTCSessionDescriptionInit)
          .then(() => flushRemoteCandidates(currentPeer, signal.candidates))
          .catch(() => {
            currentPeer.hasRemoteAnswer = false;
          });
      }

      flushRemoteCandidates(peer, signal.candidates);
    }

    // Drop peers whose viewer disappeared.
    let changed = false;
    for (const viewerId of Object.keys(session.peers)) {
      if (!viewerIds.has(viewerId)) {
        session.peers[viewerId]!.pc.close();
        delete session.peers[viewerId];
        delete session.signalState.peers[viewerId];
        changed = true;
      }
    }
    if (changed) publish();

    updateViewerStates();
  }, [
    awarenessData,
    isSharer,
    sessionId,
    pluginId,
    iceServersQuery.data,
    publish,
    updateViewerStates,
  ]);

  // Stop the capture if the remote is torn down entirely (operator closes it).
  const stopShareRef = useRef(stopShare);
  stopShareRef.current = stopShare;
  useEffect(() => {
    return () => {
      if (senderSessions[pluginId]) {
        stopShareRef.current();
      }
    };
  }, [pluginId]);

  // Output screens present anywhere in the project (app-level presence). Lets the
  // UI distinguish "no screen connected" from "connected but not on this scene".
  const outputScreenCount = awarenessData.filter(
    (s: any) => s?.user?.type === "renderer",
  ).length;

  return {
    isSharer,
    isSharing,
    sharedByOther,
    previewStream,
    viewerStates,
    outputScreenCount,
    captureError,
    iceLoading: iceServersQuery.isLoading,
    startShare,
    stopShare,
    stopSharedScreen,
  };
};
