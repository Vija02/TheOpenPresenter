import { VideoTranscodeStatus } from "@repo/graphql";
import { TypeId, fromString, fromUUID, toUUID } from "typeid-js";
import { z } from "zod";

import type { ProcessedImageFormat } from "./constants";
import { isAudioFile, isVideoFile } from "./mediaTypeUtil";

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

export const mediaDataPath = (mediaName: string) => `/media/data/${mediaName}`;

// Our own media routes on any host, eg `http://localhost:5678/media/data/media_01k....mp4`
const OWN_MEDIA_URL =
  /^[a-z][a-z0-9+.-]*:\/\/[^/?#]+(\/media\/(?:data|processed\/\d+)\/media_[0-9a-z]{26}\.[a-z0-9]{1,12}(?:[?#].*)?)$/i;

/** Use this for older data that has the full media link so that we convert
 * it into just the path
 */
export const normalizeMediaUrl = (url: string): string =>
  url.replace(OWN_MEDIA_URL, "$1");

export const resolveProcessedMediaUrl = ({
  mediaUrl,
  size,
  format,
}: {
  mediaUrl: UniversalURL;
  size: number;
  format?: ProcessedImageFormat;
}) => {
  if (isInternalMedia(mediaUrl)) {
    const query = format ? `?format=${format}` : "";
    return `${mediaUrl.host ?? window.location.origin}/media/processed/${size}/${constructMediaName(mediaUrl.mediaId, mediaUrl.extension)}${query}`;
  }

  return undefined;
};

/** Whether the media can be used yet, since video and audio need processing first */
export const isMediaReady = (media: {
  fileExtension?: string | null;
  videoMetadata?: {
    transcodeStatus?: VideoTranscodeStatus | null;
  } | null;
  audioMetadata?: {
    transcodeStatus?: VideoTranscodeStatus | null;
  } | null;
}): boolean => {
  if (isVideoFile(media.fileExtension)) {
    return (
      media.videoMetadata?.transcodeStatus === VideoTranscodeStatus.Completed
    );
  }
  if (isAudioFile(media.fileExtension)) {
    return (
      media.audioMetadata?.transcodeStatus === VideoTranscodeStatus.Completed
    );
  }
  return true;
};
