import { MediaType } from "@repo/base-plugin";
import {
  isAudioFile,
  isImageFile,
  isPdfFile,
  isPptFile,
  isVideoFile,
} from "@repo/lib";

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
