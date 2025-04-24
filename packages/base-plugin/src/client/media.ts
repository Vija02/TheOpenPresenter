import { UniversalURL } from "../types";

export const isInternalMedia = (mediaUrl: UniversalURL) => {
  return typeof mediaUrl === "object" && "mediaId" in mediaUrl;
};
