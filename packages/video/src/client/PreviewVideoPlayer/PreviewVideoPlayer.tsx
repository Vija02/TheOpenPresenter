import React from "react";
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
  return (
    <ReactPlayer
      src={src}
      controls={controls}
      playing={playing}
      muted={muted}
      width={width}
      height={height}
      onEnded={onEnded}
      config={config}
    />
  );
};
