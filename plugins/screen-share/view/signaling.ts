// WebRTC signaling (offer / answer / ICE candidates) carried over the Yjs
// awareness channel instead of a socket. Each client publishes one snapshot of
// its full signaling state; readers reconcile by diffing. One sender (operator)
// offers, N viewers (renderers + previewing operators) answer.

export type SdpInit = {
  type: RTCSdpType;
  sdp?: string;
};

// Published by the sending operator.
export type SenderSignal = {
  role: "sender";
  sessionId: string;
  // Keyed by the viewer's awareness user id.
  peers: Record<
    string,
    {
      offer?: SdpInit;
      candidates: RTCIceCandidateInit[];
    }
  >;
};

// Published by each viewer.
export type ViewerSignal = {
  role: "viewer";
  sessionId: string;
  answer?: SdpInit;
  candidates: RTCIceCandidateInit[];
};

export type Signal = SenderSignal | ViewerSignal;

// Namespaced per plugin instance so multiple screen-share scenes don't collide.
export const signalFieldKey = (pluginId: string) => `screenShare:${pluginId}`;

export type AwarenessEntry = {
  user?: { id?: string; type?: "remote" | "renderer" };
  [key: string]: any;
};

export type ReadSignal = {
  userId: string;
  type?: "remote" | "renderer";
  signal: Signal | undefined;
};

// Pull our signal field out of each awareness entry.
export const readSignals = (
  awarenessData: AwarenessEntry[],
  pluginId: string,
): ReadSignal[] => {
  const key = signalFieldKey(pluginId);
  return awarenessData
    .filter((s) => !!s?.user?.id)
    .map((s) => ({
      userId: s.user!.id as string,
      type: s.user!.type,
      signal: s[key] as Signal | undefined,
    }));
};

export const findSenderSignal = (
  signals: ReadSignal[],
  sharerAwarenessUserId: string | null,
): SenderSignal | undefined => {
  if (!sharerAwarenessUserId) return undefined;
  const entry = signals.find((s) => s.userId === sharerAwarenessUserId);
  if (entry?.signal?.role === "sender") return entry.signal;
  return undefined;
};

export const findViewerSignals = (
  signals: ReadSignal[],
  sessionId: string | null,
): {
  userId: string;
  type?: "remote" | "renderer";
  signal: ViewerSignal;
}[] => {
  if (!sessionId) return [];
  const result: {
    userId: string;
    type?: "remote" | "renderer";
    signal: ViewerSignal;
  }[] = [];
  for (const s of signals) {
    if (s.signal?.role === "viewer" && s.signal.sessionId === sessionId) {
      result.push({ userId: s.userId, type: s.type, signal: s.signal });
    }
  }
  return result;
};

// Stable identity for an ICE candidate, used to dedupe on both ends.
export const candidateKey = (c: RTCIceCandidateInit) =>
  `${c.sdpMid ?? ""}|${c.sdpMLineIndex ?? ""}|${c.candidate ?? ""}`;
