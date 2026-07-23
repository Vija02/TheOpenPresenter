import { useEffect, useRef } from "react";

export const VideoPreview = ({ stream }: { stream: MediaStream }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      muted
      playsInline
      className="w-full rounded bg-black aspect-video object-contain"
    />
  );
};
