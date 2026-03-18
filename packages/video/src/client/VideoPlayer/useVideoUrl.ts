import { extractMediaName } from "@repo/lib";
import { InternalVideo, UniversalVideo } from "../../types";
import { usePluginAPI } from "../pluginApi";
import { useMemo } from "react";

export const useVideoUrl = (video: UniversalVideo | null) => {
  const pluginApi = usePluginAPI();

  if (!video) return { videoUrl: null, isYouTube: false };

  const videoUrl = useMemo(() => {
    if (video.isInternalVideo) {
      const internalVideo = video as InternalVideo;

      if (internalVideo.hlsMediaName) {
        return pluginApi.media.resolveMediaUrl(
          extractMediaName(internalVideo.hlsMediaName),
        );
      }
    }
    return video.url;
  }, []);

  const isYouTube = useMemo(() => {
    return videoUrl
      ? videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")
      : false;
  }, [videoUrl]);

  return { videoUrl, isYouTube };
};
