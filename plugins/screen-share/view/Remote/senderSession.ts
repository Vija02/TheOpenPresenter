import { SenderSignal } from "../signaling";

export type SenderPeer = {
  pc: RTCPeerConnection;
  addedRemoteCandidates: Set<string>;
  hasRemoteAnswer: boolean;
  // "renderer" is a real output screen; "remote" is another operator previewing.
  type?: "remote" | "renderer";
};

export type SenderSession = {
  sessionId: string;
  stream: MediaStream;
  peers: Record<string, SenderPeer>; // keyed by viewer awareness user id
  signalState: SenderSignal; // snapshot republished to awareness
};

// Kept outside React/Yjs so a share survives re-renders and scene switches.
// Keyed by plugin instance id.
export const senderSessions: Record<string, SenderSession> = {};

export const randomSessionId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
