import type { MediaListItem, MediaPickerResult } from "@repo/base-types";
import { isImageFile, uuidFromMediaIdOrUUIDOrMediaName } from "@repo/lib";
import type { MediaPreviewData } from "@repo/ui";

import {
  FillPaint,
  imagePaint,
  toLayoutVideo,
  videoPaint,
} from "../../schema/paint";
import { pickedImageSrc } from "../pluginApi";

type TranscodeStatus = NonNullable<
  NonNullable<MediaPreviewData["videoMetadata"]>["transcodeStatus"]
>;

/** A library item as a fill, or null for media a fill can't show */
export const mediaToFill = (picked: MediaPickerResult): FillPaint | null => {
  if (picked.internalVideo) {
    return videoPaint({
      ...toLayoutVideo(picked.internalVideo),
      id: picked.id,
    });
  }
  if (isImageFile(picked.fileExtension))
    return imagePaint(pickedImageSrc(picked));
  return null;
};

/** Whether a fill shows this item, for marking the current choice */
export const mediaMatchesFill = (
  picked: MediaPickerResult,
  fill: FillPaint | null,
): boolean => {
  if (fill?.type === "video") {
    return (
      !!picked.internalVideo && fill.video.url === picked.internalVideo.url
    );
  }
  if (fill?.type === "image" && isImageFile(picked.fileExtension)) {
    const src = pickedImageSrc(picked);
    if (typeof src === "string" || typeof fill.src === "string") {
      return src === fill.src;
    }
    return src.mediaId === fill.src.mediaId;
  }
  return false;
};

/** An item as `MediaPreview` */
export const mediaPreviewData = (item: MediaListItem): MediaPreviewData => {
  const video = item.internalVideo;
  const uuid = (mediaName: string | null | undefined) => {
    if (!mediaName) return null;
    try {
      return uuidFromMediaIdOrUUIDOrMediaName(mediaName);
    } catch {
      return null;
    }
  };

  return {
    mediaName: item.mediaName,
    originalName: item.originalName,
    fileExtension: item.fileExtension,
    videoMetadata: video
      ? {
          thumbnailMediaId: uuid(video.thumbnailMediaName),
          hlsMediaId: uuid(video.hlsMediaName),
          transcodeStatus: (item.processing?.status ??
            "COMPLETED") as TranscodeStatus,
          transcodeProgress: item.processing?.progress ?? null,
        }
      : null,
  };
};
