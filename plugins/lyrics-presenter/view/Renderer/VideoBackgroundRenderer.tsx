import {
  InternalVideo,
  VideoPlaybackState,
  createVideoPlaybackState,
} from "@repo/video";
import { VideoPlayer } from "@repo/video/client";
import { cx } from "class-variance-authority";
import { CSSProperties, useMemo, useRef } from "react";

import { getMergedSlideStyle } from "../../src/slideStyle";
import { usePluginAPI } from "../pluginApi";

const VideoBackgroundRenderer = () => {
  const pluginApi = usePluginAPI();
  const songId = pluginApi.renderer.useData((x) => x.songId);

  const songs = pluginApi.scene.useData((x) => x.pluginData.songs);
  const globalStyle = pluginApi.scene.useData((x) => x.pluginData.style);
  const videoBackgrounds = pluginApi.scene.useData(
    (x) => x.pluginData.videoBackgrounds,
  );

  const activeSong = songs.find((x) => x.id === songId);

  const activeVideoBackgroundId = useMemo(() => {
    if (!activeSong) return null;
    const mergedStyle = getMergedSlideStyle(
      globalStyle,
      activeSong.styleOverride,
    );
    if (mergedStyle.backgroundType !== "video") return null;
    return mergedStyle.backgroundVideoMediaId ?? null;
  }, [activeSong, globalStyle]);

  const containerStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    overflow: "hidden",
  };

  return (
    <div style={containerStyle}>
      {videoBackgrounds.map((video) => (
        <VideoBackgroundItem
          key={video.id}
          video={video}
          isActive={video.id === activeVideoBackgroundId}
        />
      ))}
    </div>
  );
};

type VideoBackgroundItemProps = {
  video: InternalVideo;
  isActive: boolean;
};

const VideoBackgroundItem = ({ video, isActive }: VideoBackgroundItemProps) => {
  const playbackStateRef = useRef<VideoPlaybackState | null>(null);

  if (playbackStateRef.current === null) {
    playbackStateRef.current = createVideoPlaybackState({
      isPlaying: true,
      onFinishBehaviour: "loop",
      muted: true,
      volume: 0,
      startedAt: 0,
    });
  }

  const videoStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: isActive ? 1 : 0,
    pointerEvents: "none",
  };

  return (
    <div
      style={videoStyle}
      className={cx(isActive ? "transition-fade-in" : "transition-fade-out")}
    >
      <VideoPlayer
        video={video}
        playbackState={playbackStateRef.current}
        forceLoop
      />
    </div>
  );
};

export default VideoBackgroundRenderer;
