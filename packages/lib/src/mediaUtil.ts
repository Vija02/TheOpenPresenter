import { TypeId, fromUUID, toUUID } from "typeid-js";

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
