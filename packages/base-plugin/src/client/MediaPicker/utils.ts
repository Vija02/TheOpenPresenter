import { isAudioFile, isImageFile, isVideoFile } from "@repo/lib";

import { MediaType } from "../../types";
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
      default:
        return true;
    }
  });
};
