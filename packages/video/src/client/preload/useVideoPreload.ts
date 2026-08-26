import { useEffect, useSyncExternalStore } from "react";

import { UniversalVideo } from "../../types";
import { resolveVideoUrl } from "../videoUrl";
import {
  VideoPreloadPriority,
  VideoPreloadStatus,
  getVideoPreloadStatus,
  preloadVideo,
  subscribeToVideoPreload,
} from "./videoPreload";

/** Queues videos to be warmed ahead of playback */
export const useVideoPreload = (
  videos: (UniversalVideo | null | undefined)[],
  priority: VideoPreloadPriority = "background",
) => {
  const key = videos.map((video) => resolveVideoUrl(video) ?? "").join("\n");

  useEffect(() => {
    for (const video of videos) preloadVideo(video, priority);
    // videos is intentionally not a dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, priority]);
};

/** Whether a single video has been warmed. Useful for operator feedback. */
export const useVideoPreloadStatus = (
  video: UniversalVideo | null | undefined,
): VideoPreloadStatus => {
  const url = resolveVideoUrl(video);

  return useSyncExternalStore(
    subscribeToVideoPreload,
    () => getVideoPreloadStatus(url),
    () => "idle" as const,
  );
};
