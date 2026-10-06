import {
  MediaProcessingStatusQuery,
  VideoTranscodeStatus,
  useMediaProcessingStatusQuery,
} from "@repo/graphql";
import { useCallback, useEffect, useMemo, useState } from "react";

import { isAudioFile, isVideoFile } from "./mediaTypeUtil";

type ProcessingStatusNode = NonNullable<
  MediaProcessingStatusQuery["medias"]
>["nodes"][number];

export type VideoMetadataUpdate = NonNullable<
  ProcessingStatusNode["videoMetadata"]
>;
export type AudioMetadataUpdate = NonNullable<
  ProcessingStatusNode["audioMetadata"]
>;

type MediaWithProcessingMetadata = {
  id: string;
  fileExtension: string | null;
  videoMetadata?: { transcodeStatus: VideoTranscodeStatus } | null;
  audioMetadata?: { transcodeStatus: VideoTranscodeStatus } | null;
};

type MetadataOverride = Pick<
  ProcessingStatusNode,
  "videoMetadata" | "audioMetadata"
>;

const isStillProcessing = (
  metadata: { transcodeStatus: VideoTranscodeStatus } | null | undefined,
) =>
  !metadata ||
  metadata.transcodeStatus === VideoTranscodeStatus.Pending ||
  metadata.transcodeStatus === VideoTranscodeStatus.Processing;

/** Keeps video and audio media up to date while the worker processes them */
export function useMediaProcessingStatus<T extends MediaWithProcessingMetadata>(
  mediaList: T[],
  options: {
    enabled?: boolean;
    pollInterval?: number;
  } = {},
) {
  const { enabled = true, pollInterval = 1000 } = options;

  const [metadataOverrides, setMetadataOverrides] = useState<
    Map<string, MetadataOverride>
  >(new Map());

  const processingMediaIds = useMemo(() => {
    return mediaList
      .filter((media) => {
        const override = metadataOverrides.get(media.id);
        if (isVideoFile(media.fileExtension)) {
          return isStillProcessing(
            override?.videoMetadata ?? media.videoMetadata,
          );
        }
        if (isAudioFile(media.fileExtension)) {
          return isStillProcessing(
            override?.audioMetadata ?? media.audioMetadata,
          );
        }
        return false;
      })
      .map((media) => media.id);
  }, [mediaList, metadataOverrides]);

  // Lightweight query to poll only the processing status
  const [{ data: processingStatusData }, refetchProcessingStatus] =
    useMediaProcessingStatusQuery({
      variables: { mediaIds: processingMediaIds },
      pause: !enabled || processingMediaIds.length === 0,
    });

  useEffect(() => {
    if (!processingStatusData?.medias?.nodes) return;

    setMetadataOverrides((prev) => {
      const newMap = new Map(prev);
      for (const media of processingStatusData.medias!.nodes) {
        if (media.videoMetadata || media.audioMetadata) {
          newMap.set(media.id, {
            videoMetadata: media.videoMetadata,
            audioMetadata: media.audioMetadata,
          });
        }
      }
      return newMap;
    });
  }, [processingStatusData]);

  useEffect(() => {
    if (!enabled || processingMediaIds.length === 0) return;

    const interval = setInterval(() => {
      refetchProcessingStatus({ requestPolicy: "network-only" });
    }, pollInterval);

    return () => clearInterval(interval);
  }, [
    enabled,
    processingMediaIds.length,
    refetchProcessingStatus,
    pollInterval,
  ]);

  const mediaListWithUpdates = useMemo(() => {
    return mediaList.map((media) => {
      const override = metadataOverrides.get(media.id);
      if (!override) return media;
      return {
        ...media,
        ...(override.videoMetadata
          ? { videoMetadata: override.videoMetadata }
          : {}),
        ...(override.audioMetadata
          ? { audioMetadata: override.audioMetadata }
          : {}),
      };
    });
  }, [mediaList, metadataOverrides]);

  const resetOverrides = useCallback(() => {
    setMetadataOverrides(new Map());
  }, []);

  return {
    mediaList: mediaListWithUpdates,
    processingMediaIds,
    hasProcessingMedia: processingMediaIds.length > 0,
    resetOverrides,
  };
}
