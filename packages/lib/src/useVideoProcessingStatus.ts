import {
  MediaVideoProcessingStatusQuery,
  VideoTranscodeStatus,
  useMediaVideoProcessingStatusQuery,
} from "@repo/graphql";
import { useEffect, useMemo, useState } from "react";

import { isVideoFile } from "./mediaTypeUtil";

// Video metadata type from the processing status query
export type VideoMetadataUpdate = NonNullable<
  NonNullable<
    MediaVideoProcessingStatusQuery["medias"]
  >["nodes"][number]["videoMetadata"]
>;

// Type for media items that have video metadata
type MediaWithVideoMetadata = {
  id: string;
  fileExtension: string | null;
  videoMetadata?: {
    transcodeStatus: VideoTranscodeStatus;
  } | null;
};

export function useVideoProcessingStatus<T extends MediaWithVideoMetadata>(
  mediaList: T[],
  options: {
    enabled?: boolean;
    pollInterval?: number;
  } = {},
) {
  const { enabled = true, pollInterval = 1000 } = options;

  // Local state to store video metadata updates from polling
  const [videoMetadataOverrides, setVideoMetadataOverrides] = useState<
    Map<string, VideoMetadataUpdate>
  >(new Map());

  // Get IDs of videos that are still processing
  const processingVideoIds = useMemo(() => {
    return mediaList
      .filter((media) => {
        if (!isVideoFile(media.fileExtension)) return false;
        // Check override first, then original
        const override = videoMetadataOverrides.get(media.id);
        const videoMeta = override ?? media.videoMetadata;
        if (!videoMeta) return true;
        return (
          videoMeta.transcodeStatus === VideoTranscodeStatus.Pending ||
          videoMeta.transcodeStatus === VideoTranscodeStatus.Processing
        );
      })
      .map((media) => media.id);
  }, [mediaList, videoMetadataOverrides]);

  // Lightweight query to poll only video processing status
  const [{ data: processingStatusData }, refetchProcessingStatus] =
    useMediaVideoProcessingStatusQuery({
      variables: { mediaIds: processingVideoIds },
      pause: !enabled || processingVideoIds.length === 0,
    });

  // Update video metadata overrides when polling data changes
  useEffect(() => {
    if (!processingStatusData?.medias?.nodes) return;

    setVideoMetadataOverrides((prev) => {
      const newMap = new Map(prev);
      for (const media of processingStatusData.medias!.nodes) {
        if (media.videoMetadata) {
          newMap.set(media.id, media.videoMetadata);
        }
      }
      return newMap;
    });
  }, [processingStatusData]);

  // Poll for updates when there are processing videos
  useEffect(() => {
    if (!enabled || processingVideoIds.length === 0) return;

    const interval = setInterval(() => {
      refetchProcessingStatus({ requestPolicy: "network-only" });
    }, pollInterval);

    return () => clearInterval(interval);
  }, [
    enabled,
    processingVideoIds.length,
    refetchProcessingStatus,
    pollInterval,
  ]);

  const mediaListWithUpdates = useMemo(() => {
    return mediaList.map((media) => {
      const override = videoMetadataOverrides.get(media.id);
      if (override) {
        return {
          ...media,
          videoMetadata: override,
        };
      }
      return media;
    });
  }, [mediaList, videoMetadataOverrides]);

  const resetOverrides = () => {
    setVideoMetadataOverrides(new Map());
  };

  return {
    mediaList: mediaListWithUpdates,
    processingVideoIds,
    hasProcessingVideos: processingVideoIds.length > 0,
    resetOverrides,
  };
}
