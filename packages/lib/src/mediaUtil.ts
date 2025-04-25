import { TypeId, fromUUID, toUUID } from "typeid-js";

export type InternalMedia = {
  mediaId: string;
  extension: string;
};
export type UniversalURL = string | InternalMedia;

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

export const mediaIdFromUUID = (uuid: string) => {
  return fromUUID(uuid, "media");
};

export const constructMediaName = (mediaId: string, extension: string) => {
  return mediaId + "." + extension;
};

export const uuidFromMediaId = (mediaId: string) => {
  return toUUID(mediaId as TypeId<string>);
};

export const uuidFromMediaIdOrUUID = (mediaIdOrUUID: string) => {
  return mediaIdOrUUID.startsWith("media")
    ? toUUID(mediaIdOrUUID as TypeId<string>)
    : mediaIdOrUUID;
};

export const isInternalMedia = (mediaUrl: UniversalURL) => {
  return typeof mediaUrl === "object" && "mediaId" in mediaUrl;
};

export const resolveMediaUrl = (mediaUrl: UniversalURL) => {
  if (isInternalMedia(mediaUrl)) {
    const mediaName = mediaUrl.mediaId + "." + mediaUrl.extension;
    return window.location.origin + "/media/data/" + mediaName;
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
    const resolvedUrl = resolveMediaUrl(mediaUrl);
    return `${window.location.origin}/media/processed/${size}/${resolvedUrl}`;
  }

  return undefined;
};
