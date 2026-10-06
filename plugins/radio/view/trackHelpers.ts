import { extractMediaName, resolveMediaUrl } from "@repo/lib";
import type { UniversalVideo } from "@repo/video";

import { Track } from "../src/types";

export const trackTitle = (track: Track) =>
  track.metadata.title ?? (track.type === "youtube" ? track.url : "Untitled");

export const trackCoverUrl = (track: Track) => {
  if (track.type === "youtube") return track.metadata.thumbnailUrl;
  return track.coverMediaName
    ? resolveMediaUrl(extractMediaName(track.coverMediaName))
    : undefined;
};

/** A library track can't play until it's been processed */
export const isTrackReady = (track: Track) =>
  track.type === "youtube" || !!track.playbackMediaName;

/** What the player loads */
export const trackVideo = (track: Track): UniversalVideo | null => {
  if (track.type === "youtube") return track;
  if (!track.playbackMediaName) return null;
  return {
    id: track.id,
    url: resolveMediaUrl(extractMediaName(track.playbackMediaName)),
    metadata: track.metadata,
  };
};
