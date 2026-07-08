import { resolveMediaUrl } from "@repo/lib";
import { InternalVideo } from "@repo/video";
import { createContext, useContext, useMemo } from "react";

import { SlideStyle } from "../../src/index.js";
import { usePluginAPI } from "../pluginApi";

/**
 * When set, previews resolve background videos from this list instead of the
 * scene's `videoBackgrounds`
 */
export const PreviewVideoBackgroundsContext = createContext<
  InternalVideo[] | null
>(null);

export const useVideoBackgroundThumbnail = (
  slideStyle: Required<SlideStyle>,
  enabled: boolean,
) => {
  const pluginApi = usePluginAPI();
  const sceneVideoBackgrounds = pluginApi.scene.useData(
    (x) => x.pluginData.videoBackgrounds,
  );
  const previewVideoBackgrounds = useContext(PreviewVideoBackgroundsContext);
  const videoBackgrounds = previewVideoBackgrounds ?? sceneVideoBackgrounds;

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
