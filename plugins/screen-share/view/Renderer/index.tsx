import { useEffect, useRef } from "react";

import { useScreenShareViewer } from "./useScreenShareViewer";

const ScreenShareRenderer = () => {
  const { isSharing, remoteStream, connectionState } = useScreenShareViewer();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (!isSharing) {
    return null;
  }

  const failed =
    connectionState === "failed" || connectionState === "disconnected";

  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-contain"
        style={{ display: remoteStream ? "block" : "none" }}
      />
      {!remoteStream && (
        <div className="text-white/80 text-2xl">
          {failed ? "Connection lost. Reconnecting…" : "Connecting screen…"}
        </div>
      )}
    </div>
  );
};

export default ScreenShareRenderer;
