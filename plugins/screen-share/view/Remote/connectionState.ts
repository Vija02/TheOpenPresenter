export const connectionLabel = (state: RTCPeerConnectionState) => {
  switch (state) {
    case "connected":
      return "Connected";
    case "connecting":
    case "new":
      return "Connecting…";
    case "disconnected":
      return "Disconnected";
    case "failed":
      return "Failed";
    case "closed":
      return "Closed";
    default:
      return state;
  }
};

export const connectionColor = (state: RTCPeerConnectionState) => {
  if (state === "connected") return "text-green-600";
  if (state === "failed" || state === "disconnected") return "text-red-600";
  return "text-yellow-600";
};
