import { useLayoutEffect, useState } from "react";

import { Video } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import { calculateActualSeek } from "../calculateActualSeek";

export const useSeek = (video: Video, currentVideoIsPlaying: boolean) => {
  const pluginApi = usePluginAPI();

  const mutableRendererData = pluginApi.renderer.useValtioData();

  const seek = pluginApi.renderer.useData((x) => x.videoSeeks?.[video.id]);
  const [localSeek, setLocalSeek] = useState(seek ?? 0);

  useLayoutEffect(() => {
    if (currentVideoIsPlaying) {
      const updateActualSeek = () => {
        const currentPlayingVideo = mutableRendererData.currentPlayingVideo!;

        setLocalSeek(
          calculateActualSeek(
            currentPlayingVideo,
            video.metadata.duration ?? 0,
          ),
        );
      };
      const interval = setInterval(updateActualSeek, 100);

      updateActualSeek();

      return () => {
        clearInterval(interval);
      };
    }
  }, [
    currentVideoIsPlaying,
    mutableRendererData.currentPlayingVideo,
    video.metadata.duration,
  ]);

  if (!currentVideoIsPlaying) {
    return seek ?? 0;
  }

  return localSeek;
};
