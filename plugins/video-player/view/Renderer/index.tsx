import { VideoPlaybackState, volumeToAmplitude } from "@repo/video";
import { VideoPlayer, useVideoPreload } from "@repo/video/client";
import { useMemo } from "react";

import { usePluginAPI } from "../pluginApi";
import { useVideoSequence } from "../useVideoSequence";

const VideoPlayerRenderer = () => {
  const pluginApi = usePluginAPI();

  const videos = pluginApi.scene.useData((x) => x.pluginData.videos);
  const { videoId, playbackState } = useVideoSequence();

  useVideoPreload(videos);

  if (!videoId) {
    return null;
  }

  return (
    <VideoPlayerRendererInner
      key={videoId}
      videoId={videoId}
      playbackState={playbackState}
    />
  );
};

const VideoPlayerRendererInner = ({
  videoId,
  playbackState,
}: {
  videoId: string;
  playbackState: VideoPlaybackState | null;
}) => {
  const pluginApi = usePluginAPI();

  const videos = pluginApi.scene.useData((x) => x.pluginData.videos);

  const mutableSceneData = pluginApi.scene.useValtioData();

  const currentVideo = useMemo(
    () => videos.find((vid) => vid.id === videoId),
    [videoId, videos],
  );

  const scaledVolume = volumeToAmplitude(
    pluginApi.audio.useVolume(playbackState?.volume ?? 1),
  );
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
