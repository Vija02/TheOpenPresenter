import { extractMediaName, resolveMediaUrl } from "@repo/lib";

import { InternalVideo, UniversalVideo } from "../types";

/** The URL a player should actually load for a video. HLS wins when available */
export const resolveVideoUrl = (
  video: UniversalVideo | null | undefined,
): string | null => {
  if (!video) return null;

  if (video.isInternalVideo) {
    const internalVideo = video as InternalVideo;

    if (internalVideo.hlsMediaName) {
      try {
        return resolveMediaUrl(extractMediaName(internalVideo.hlsMediaName));
      } catch {
        return video.url ?? null;
      }
    }
  }

  return video.url ?? null;
};

export const isYouTubeUrl = (url: string | null): boolean =>
  url ? url.includes("youtube.com") || url.includes("youtu.be") : false;

export const isHlsUrl = (url: string): boolean =>
  url.split("?")[0]!.endsWith(".m3u8");
