import { resolveMediaUrl } from "@repo/lib";
import { useMemo } from "react";

import { SlideStyle } from "../../src/index.js";
import { usePluginAPI } from "../pluginApi";

export const useVideoBackgroundThumbnail = (
  slideStyle: Required<SlideStyle>,
  enabled: boolean,
) => {
  const pluginApi = usePluginAPI();
  const videoBackgrounds = pluginApi.scene.useData(
    (x) => x.pluginData.videoBackgrounds,
  );

  return useMemo(() => {
    if (!enabled) return null;
    if (
      slideStyle.backgroundType !== "video" ||
      !slideStyle.backgroundVideoMediaId
    ) {
      return null;
    }

    const video = videoBackgrounds.find(
      (v) => v.id === slideStyle.backgroundVideoMediaId,
    );
    if (!video) return null;

    // Try to get thumbnail URL
    if (video.metadata.thumbnailUrl) {
      return video.metadata.thumbnailUrl;
    }
    if (video.thumbnailMediaName) {
      return resolveMediaUrl(video.thumbnailMediaName);
    }

    return null;
  }, [
    enabled,
    slideStyle.backgroundType,
    slideStyle.backgroundVideoMediaId,
    videoBackgrounds,
  ]);
};
