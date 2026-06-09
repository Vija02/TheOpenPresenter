import React, { useState } from "react";
import ReactPlayer from "react-player";
import { Config } from "react-player/types";

export type PreviewVideoPlayerProps = {
  src: string;
  controls?: boolean;
  playing?: boolean;
  muted?: boolean;
  width?: string | number;
  height?: string | number;
  onEnded?: () => void;
  config?: Config;
};

export const PreviewVideoPlayer: React.FC<PreviewVideoPlayerProps> = ({
  src,
  controls = true,
  playing = true,
  muted,
  width = "100%",
  height = "100%",
  onEnded,
  config,
}) => {
  const [isPlaying, setIsPlaying] = useState(playing);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(muted ?? false);

  return (
    <ReactPlayer
      src={src}
      controls={controls}
      playing={isPlaying}
      volume={volume}
      muted={isMuted}
      width={width}
      height={height}
      onPlay={() => setIsPlaying(true)}
      onPause={() => setIsPlaying(false)}
      onVolumeChange={(e) => {
        const el = e.currentTarget;
        setVolume(el.volume);
        setIsMuted(el.muted);
      }}
      onEnded={onEnded}
      config={config}
    />
  );
};
