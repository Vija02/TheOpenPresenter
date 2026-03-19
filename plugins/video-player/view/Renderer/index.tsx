import { VideoPlayer } from "@repo/video/client";
import { useMemo } from "react";

import { usePluginAPI } from "../pluginApi";

const VideoPlayerRenderer = () => {
  const pluginApi = usePluginAPI();

  const activeVideoId = pluginApi.renderer.useData((x) => x.activeVideoId);

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

  if (!currentVideo || !playbackState) {
    return null;
  }

  return (
    <VideoPlayer
      video={currentVideo}
      playbackState={playbackState}
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
