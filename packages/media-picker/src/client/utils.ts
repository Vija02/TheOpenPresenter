import {
  MediaPickerResult,
  MediaProcessing,
  MediaType,
} from "@repo/base-plugin";
import { VideoTranscodeStatus } from "@repo/graphql";
import {
  extractMediaName,
  isAudioFile,
  isImageFile,
  isMediaReady,
  isPdfFile,
  isPptFile,
  isVideoFile,
  mediaIdFromUUID,
  resolveMediaUrl,
} from "@repo/lib";
import { typeidUnboxed } from "typeid-js";

import { MediaWithMetadata } from "./types";

const matchesType = (ext: string, type: MediaType): boolean => {
  switch (type) {
    case "video":
      return isVideoFile(ext);
    case "image":
      return isImageFile(ext);
    case "audio":
      return isAudioFile(ext);
    case "pdf":
      return isPdfFile(ext);
    case "ppt":
      return isPptFile(ext);
    default:
      return true;
  }
};

export const filterMediaByType = (
  media: MediaWithMetadata[],
  type: MediaType | MediaType[],
): MediaWithMetadata[] => {
  const types = Array.isArray(type) ? type : [type];

  if (types.length === 0 || types.includes("all")) return media;

  return media.filter((m) =>
    types.some((t) => m.fileExtension && matchesType(m.fileExtension, t)),
  );
};

/** What the picker resolves with for a library item */
export const buildMediaPickerResult = (
  media: MediaWithMetadata,
): MediaPickerResult => {
  const mediaUrl = resolveMediaUrl(extractMediaName(media.mediaName));

  const result: MediaPickerResult = {
    id: media.id,
    mediaName: media.mediaName,
    originalName: media.originalName,
    fileExtension: media.fileExtension,
    url: mediaUrl,
  };

  if (isVideoFile(media.fileExtension)) {
    const videoMeta = media.videoMetadata;

    let hlsMediaName: string | null = null;
    let thumbnailMediaName: string | null = null;
    let duration: number | null = null;

    if (videoMeta) {
      if (videoMeta.hlsMediaId) {
        hlsMediaName = mediaIdFromUUID(videoMeta.hlsMediaId) + ".m3u8";
      }
      if (videoMeta.thumbnailMediaId) {
        thumbnailMediaName =
          mediaIdFromUUID(videoMeta.thumbnailMediaId) + ".jpg";
      }
      duration = parseFloat(videoMeta.duration);
    }

    result.internalVideo = {
      id: typeidUnboxed("video"),
      url: result.url,
      isInternalVideo: true,
      hlsMediaName: hlsMediaName,
      thumbnailMediaName: thumbnailMediaName,
      metadata: {
        title: result.originalName ?? result.mediaName,
        ...(thumbnailMediaName
          ? {
              thumbnailUrl: resolveMediaUrl(
                extractMediaName(thumbnailMediaName),
              ),
            }
          : {}),
        ...(duration
          ? {
              duration,
            }
          : {}),
      },
    };
  }

  if (isAudioFile(media.fileExtension)) {
    const audioMeta = media.audioMetadata;
    const duration = audioMeta?.duration
      ? parseFloat(audioMeta.duration)
      : null;

    result.internalAudio = {
      playbackMediaName: audioMeta?.playbackMedia?.mediaName ?? null,
      coverMediaName: audioMeta?.coverMedia?.mediaName ?? null,
      metadata: JSON.parse(
        JSON.stringify({
          title: audioMeta?.title ?? result.originalName ?? result.mediaName,
          artist: audioMeta?.artist ?? undefined,
          album: audioMeta?.album ?? undefined,
          duration: duration ?? undefined,
        }),
      ),
    };
  }

  const imageDependency = media.dependencies.nodes.find((dep) =>
    isImageFile(dep.childMedia?.fileExtension),
  );
  if (imageDependency?.childMedia) {
    result.extraMeta = {
      childThumbnailUrl: resolveMediaUrl(
        extractMediaName(imageDependency.childMedia.mediaName),
      ),
    };
  }

  return result;
};

/** Null once the item can be used, else how processing is going */
export const mediaProcessing = (
  media: MediaWithMetadata,
): MediaProcessing | null => {
  if (isMediaReady(media)) return null;
  const meta = isVideoFile(media.fileExtension)
    ? media.videoMetadata
    : media.audioMetadata;
  const status = meta?.transcodeStatus;
  return {
    status:
      status === VideoTranscodeStatus.Failed
        ? "FAILED"
        : status === VideoTranscodeStatus.Processing
          ? "PROCESSING"
          : "PENDING",
    progress: meta?.transcodeProgress ?? null,
  };
};
