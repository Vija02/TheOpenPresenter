import { MediaType } from "@repo/base-plugin";
import {
  isAudioFile,
  isImageFile,
  isPdfFile,
  isPptFile,
  isVideoFile,
} from "@repo/lib";

import { MediaWithMetadata } from "./types";

export const filterMediaByType = (
  media: MediaWithMetadata[],
  type: MediaType,
): MediaWithMetadata[] => {
  if (type === "all") return media;

  return media.filter((m) => {
    const ext = m.fileExtension;
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
  });
};
