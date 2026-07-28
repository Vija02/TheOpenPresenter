import { VideoTranscodeStatus } from "@repo/graphql";
import { TypeId, fromString, fromUUID, toUUID } from "typeid-js";
import { z } from "zod";

import { isVideoFile } from "./mediaTypeUtil";

export const internalMediaValidator = z.object({
  mediaId: z.string(),
  extension: z.string(),
  host: z.string().optional(),
});
export type InternalMedia = z.infer<typeof internalMediaValidator>;

export const universalURLValidator = z.union([
  z.string(),
  internalMediaValidator,
]);
export type UniversalURL = z.infer<typeof universalURLValidator>;

export const extractMediaName = (mediaName: string) => {
  const splittedKey = mediaName.split(".");
  if (splittedKey.length !== 2) {
    throw new Error("Invalid Media Name");
  }
  const mediaId = splittedKey[0]!;
  const extension = splittedKey[1]!;
  const uuid = uuidFromMediaId(mediaId);

  return { uuid, mediaId, extension };
};

export const isValidMediaName = (mediaName: string): boolean => {
  try {
    const { mediaId, extension } = extractMediaName(mediaName);
    if (!/^[a-z0-9]{1,12}$/i.test(extension)) return false;
    // Throws on an invalid typeid
    fromString(mediaId, "media");
    return true;
  } catch {
    return false;
  }
};

export const mediaIdFromUUID = (uuid: string) => {
  return fromUUID(uuid, "media");
};

export const constructMediaName = (mediaId: string, extension: string) => {
  return mediaId + "." + extension;
};

export const uuidFromMediaId = (mediaId: string) => {
  return toUUID(mediaId as TypeId<string>);
};

export const uuidFromMediaIdOrUUIDOrMediaName = (
  mediaIdOrUUIDOrMediaName: string,
) => {
  if (mediaIdOrUUIDOrMediaName.startsWith("media")) {
    if (mediaIdOrUUIDOrMediaName.includes(".")) {
      // Media Name
      return extractMediaName(mediaIdOrUUIDOrMediaName).uuid;
    } else {
      // Media ID
      return uuidFromMediaId(mediaIdOrUUIDOrMediaName);
    }
  } else {
    // UUID
    return mediaIdOrUUIDOrMediaName;
  }
};

export const isInternalMedia = (mediaUrl: UniversalURL) => {
  return typeof mediaUrl === "object" && "mediaId" in mediaUrl;
};

export const resolveMediaUrl = (mediaUrl: UniversalURL) => {
  if (isInternalMedia(mediaUrl)) {
    const mediaName = mediaUrl.mediaId + "." + mediaUrl.extension;
    return (
      (mediaUrl.host ?? window.location.origin) + "/media/data/" + mediaName
    );
  }
  return mediaUrl;
};

export const resolveProcessedMediaUrl = ({
  mediaUrl,
  size,
}: {
  mediaUrl: UniversalURL;
  size: number;
}) => {
  if (isInternalMedia(mediaUrl)) {
    return `${mediaUrl.host ?? window.location.origin}/media/processed/${size}/${constructMediaName(mediaUrl.mediaId, mediaUrl.extension)}`;
  }

  return undefined;
};

export const isVideoReady = (media: {
  fileExtension?: string | null;
  videoMetadata?: {
    transcodeStatus?: VideoTranscodeStatus | null;
  } | null;
}): boolean => {
  if (!isVideoFile(media.fileExtension)) return true;
  const videoMeta = media.videoMetadata;
  if (!videoMeta) return false;
  return videoMeta.transcodeStatus === VideoTranscodeStatus.Completed;
};
