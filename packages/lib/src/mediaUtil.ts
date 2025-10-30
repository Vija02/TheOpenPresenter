import { TypeId, fromUUID, toUUID } from "typeid-js";

export type InternalMedia = {
  mediaId: string;
  extension: string;
  host?: string;
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
