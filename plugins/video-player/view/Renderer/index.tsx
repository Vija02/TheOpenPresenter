import { VideoPlayer, useVideoPreload } from "@repo/video/client";
import { useMemo } from "react";

import { usePluginAPI } from "../pluginApi";

const VideoPlayerRenderer = () => {
  const pluginApi = usePluginAPI();

  const activeVideoId = pluginApi.renderer.useData((x) => x.activeVideoId);
  const videos = pluginApi.scene.useData((x) => x.pluginData.videos);

  useVideoPreload(videos);

  if (!activeVideoId) {
    return null;
  }

  return (
    <VideoPlayerRendererInner key={activeVideoId} videoId={activeVideoId} />
  );
};

const VideoPlayerRendererInner = ({ videoId }: { videoId: string }) => {
  const pluginApi = usePluginAPI();

  const videos = pluginApi.scene.useData((x) => x.pluginData.videos);
  const videoStates = pluginApi.renderer.useData((x) => x.videoStates);

  const mutableSceneData = pluginApi.scene.useValtioData();

  const currentVideo = useMemo(
    () => videos.find((vid) => vid.id === videoId),
    [videoId, videos],
  );

  const playbackState = videoStates[videoId] ?? null;

  const scaledVolume = pluginApi.audio.useVolume(playbackState?.volume ?? 1);
  const scaledPlaybackState = useMemo(
    () => (playbackState ? { ...playbackState, volume: scaledVolume } : null),
    [playbackState, scaledVolume],
  );

  if (!currentVideo || !scaledPlaybackState) {
    return null;
  }

  return (
    <VideoPlayer
      video={currentVideo}
      playbackState={scaledPlaybackState}
      onDurationChange={(dur: number) => {
        const index = mutableSceneData.pluginData.videos.findIndex(
          (x) => x.id === videoId,
        );
        if (
          mutableSceneData.pluginData.videos[index]?.metadata.duration ==
            undefined ||
          mutableSceneData.pluginData.videos[index]?.metadata.duration === 0
        ) {
          mutableSceneData.pluginData.videos[index]!.metadata.duration = dur;
        }
      }}
      onAwarenessLoadingChange={(isLoading: boolean) => {
        pluginApi.awareness.setAwarenessStateData({ isLoading });
      }}
      onError={(err: Error, errorData?: unknown) => {
        pluginApi.log.error({ err, errorData }, "Error on Video playback");
      }}
    />
  );
};

export default VideoPlayerRenderer;
