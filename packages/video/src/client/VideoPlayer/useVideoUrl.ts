import { UniversalVideo } from "../../types";
import { isYouTubeUrl, resolveVideoUrl } from "../videoUrl";
import { useMemo } from "react";

export const useVideoUrl = (video: UniversalVideo | null) => {
  const videoUrl = useMemo(() => resolveVideoUrl(video), [video]);

  const isYouTube = useMemo(() => isYouTubeUrl(videoUrl), [videoUrl]);

  return { videoUrl, isYouTube };
};
