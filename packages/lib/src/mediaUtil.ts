import { TypeId, fromUUID, toUUID } from "typeid-js";

export const extractMediaName = (mediaName: string) => {
  const splittedKey = mediaName.split(".");
  const mediaId = splittedKey[0];
  const extension = splittedKey[1];
  const uuid = toUUID(mediaId as TypeId<string>);

  return { uuid, mediaId, extension };
};

export const mediaIdFromUUID = (uuid: string) => {
  return fromUUID("media", uuid);
};

export const constructMediaName = (mediaId: string, extension: string) => {
  return mediaId + "." + extension;
};
