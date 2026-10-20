import { extractMediaName } from "@repo/lib";

import {
  OFFICE_SPRITE_WIDTHS,
  type OfficeSpriteTier,
} from "../../../src/office/sprites";
import type { OfficeDeck } from "../../../src/office/types";
import type { ResolveImage } from "./OfficeSlideView";

type MediaResolver = {
  resolveMediaUrl: (name: ReturnType<typeof extractMediaName>) => string;
  resolveProcessedMediaUrl: (options: {
    mediaUrl: ReturnType<typeof extractMediaName>;
    size: number;
  }) => string | undefined;
};

/** Early imports stored `/media/data/<file>` */
const fileNameOf = (src: string) => src.replace(/^\/?media\/data\//, "");

/** A stored media file (video, sound) as a loadable url */
export const officeMediaUrl = (src: string, media: MediaResolver) =>
  /^https?:\/\//.test(src)
    ? src
    : media.resolveMediaUrl(extractMediaName(fileNameOf(src)));

/**
 * A sprite sheet from `/media/processed` (WebP where the browser shows it),
 * full size or small for previews. A small copy needs the sheet's real size so
 * it can be drawn at it.
 */
export const officeImageResolver =
  (
    deck: OfficeDeck,
    media: MediaResolver,
    tier: OfficeSpriteTier = "full",
  ): ResolveImage =>
  (imageId) => {
    const src = deck.images[imageId];
    if (!src) return undefined;
    if (/^https?:\/\//.test(src)) return { url: src };
    const size = deck.imageSizes?.[imageId];
    const width =
      tier === "preview" && size
        ? OFFICE_SPRITE_WIDTHS.preview
        : OFFICE_SPRITE_WIDTHS.full;
    const url =
      media.resolveProcessedMediaUrl({
        mediaUrl: extractMediaName(fileNameOf(src)),
        size: width,
      }) ?? officeMediaUrl(src, media);
    return { url, size };
  };
