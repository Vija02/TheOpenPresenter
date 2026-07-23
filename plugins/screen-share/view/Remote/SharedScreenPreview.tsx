import { useEffect, useRef } from "react";

import { useScreenShareViewer } from "../Renderer/useScreenShareViewer";

// Preview of a share owned by *another* operator
export const SharedScreenPreview = () => {
  const { remoteStream, connectionState } = useScreenShareViewer();
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="relative w-full aspect-video rounded bg-black">
      <video
        ref={ref}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full rounded object-contain"
        style={{ display: remoteStream ? "block" : "none" }}
      />
      {!remoteStream && (
        <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">
          {connectionState === "failed" || connectionState === "disconnected"
            ? "Connection lost. Reconnecting…"
            : "Connecting to shared screen…"}
        </div>
      )}
    </div>
  );
};
