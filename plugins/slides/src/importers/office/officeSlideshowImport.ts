import type { ServerPluginApi } from "@repo/base-plugin/server";
import axios from "axios";
import pLimit from "p-limit";
import { pino } from "pino";

import {
  OFFICE_SPRITE_FORMAT,
  OFFICE_SPRITE_WIDTHS,
  imageDimensions,
} from "../../office/sprites";
import { compileTimeline, navigationTiming } from "../../office/timeline";
import { transitionPlayback } from "../../office/transitions";
import type { OfficeDeck } from "../../office/types";
import type { OfficeSlideshowResult } from "./fetchOfficeSlideshow";

/** What a PowerPoint import stores to play its animations */
export type OfficeImportFields = {
  office: OfficeDeck;
  slideClickCounts: number[];
  slideClickDurations: number[][];
  slideAutoplayDurations: number[];
  slideTransitionDurations: number[];
};

/**
 * Lines the slideshow's slides up with the PDF pages we show as thumbnails.
 * The export can leave hidden slides out, so try without them before giving
 * up. Returns null when they can't be matched one to one.
 */
export const alignSlidesWithPages = (
  deck: OfficeDeck,
  pageCount: number,
): OfficeDeck | null => {
  if (deck.slides.length === pageCount) return deck;
  const shown = deck.slides.filter((slide) => !slide.hidden);
  if (shown.length === pageCount) return { ...deck, slides: shown };
  return null;
};

export const officeImportFields = (office: OfficeDeck): OfficeImportFields => {
  const timings = office.slides.map((slide) =>
    navigationTiming(compileTimeline(slide)),
  );
  return {
    office,
    slideClickCounts: timings.map((t) => t.clickCount),
    slideClickDurations: timings.map((t) => t.clickDurationsMs),
    slideAutoplayDurations: timings.map((t) => t.autoplayMs),
    slideTransitionDurations: office.slides.map(
      (slide) => transitionPlayback(slide.transition).durationMs,
    ),
  };
};

/**
 * Stores the sprite sheets as media under the import's PDF (so they go when
 * it goes) and returns the fields to save on the import.
 */
export async function storeOfficeSlideshow(
  result: OfficeSlideshowResult,
  {
    serverPluginApi,
    organizationId,
    userId,
    projectId,
    pluginId,
    parentMediaId,
    pageCount,
  }: {
    serverPluginApi: ServerPluginApi<any, any>;
    organizationId: string;
    userId: string | null;
    projectId: string;
    pluginId: string;
    parentMediaId: string;
    pageCount: number;
  },
  log: pino.Logger,
): Promise<OfficeImportFields | null> {
  const aligned = alignSlidesWithPages(result.deck, pageCount);
  if (!aligned) {
    log.warn(
      { slides: result.deck.slides.length, pageCount },
      "Office slideshow: slides don't match the PDF pages, showing images only",
    );
    return null;
  }

  const limit = pLimit(8);
  const images: Record<string, string> = {};
  const imageSizes: Record<string, { w: number; h: number }> = {};
  await Promise.all(
    [...result.images.entries()].map(([id, image]) =>
      limit(async () => {
        const uploaded = await serverPluginApi.uploadMedia(
          image.buffer,
          image.extension,
          {
            organizationId,
            userId,
            isGuest: userId == null,
            parentMediaIdOrUUID: parentMediaId,
            attachTo: { projectId, pluginId },
          },
        );
        images[id] = uploaded.fileName;
        const size = imageDimensions(image.buffer);
        if (size) imageSizes[id] = size;
      }),
    ),
  );
  const media: Record<string, string> = {};
  await Promise.all(
    [...result.media.entries()].map(([id, file]) =>
      limit(async () => {
        const uploaded = await serverPluginApi.uploadMedia(
          file.buffer,
          file.extension,
          {
            organizationId,
            userId,
            isGuest: userId == null,
            parentMediaIdOrUUID: parentMediaId,
            attachTo: { projectId, pluginId },
          },
        );
        media[id] = uploaded.fileName;
      }),
    ),
  );
  log.info(
    { images: Object.keys(images).length, media: Object.keys(media).length },
    "Office slideshow: sprites uploaded",
  );

  return officeImportFields({ ...aligned, images, imageSizes, media });
}

/**
 * Has `/media/processed` make the sprite variants the renderer will ask for,
 * so the first time a slide is shown its images are already waiting.
 */
export async function warmOfficeSprites(
  office: OfficeDeck,
  rootUrl: string,
  log: pino.Logger,
) {
  const limit = pLimit(4);
  const started = Date.now();
  let failed = 0;
  await Promise.all(
    Object.values(office.images).flatMap((fileName) =>
      Object.values(OFFICE_SPRITE_WIDTHS).map((width) =>
        limit(async () => {
          // The endpoint answers with a redirect once the variant exists
          const res = await axios
            .get(
              `${rootUrl}/media/processed/${width}/${fileName}?format=${OFFICE_SPRITE_FORMAT}`,
              { maxRedirects: 0, validateStatus: () => true, timeout: 120000 },
            )
            .catch(() => null);
          if (!res || res.status >= 400) failed += 1;
        }),
      ),
    ),
  );
  log.info(
    { ms: Date.now() - started, failed },
    "Office slideshow: sprite variants prepared",
  );
}
