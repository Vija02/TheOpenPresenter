import { useWebPSupport } from "@repo/lib";
import { useMemo } from "react";

import { SETTLED } from "../../../src/office/evaluate";
import { collectSlideImageIds } from "../../../src/office/normalize";
import {
  compileTimeline,
  groupForClickCount,
} from "../../../src/office/timeline";
import { hasOfficeSlideshow } from "../../../src/types";
import {
  OfficeSlideView,
  type ResolveImage,
} from "../../Renderer/PowerPointRenderer/OfficeSlideView";
import { officeImageResolver } from "../../Renderer/PowerPointRenderer/officeImageUrl";
import { useSpriteStore } from "../../Renderer/PowerPointRenderer/spriteStore";
import { usePluginAPI } from "../../pluginApi";
import type { PreviewStep } from "./SidePreviews";

const NO_URLS: string[] = [];

/**
 * A PowerPoint step as it looks once finished. Our player is deterministic,
 * so unlike Google Slides there is nothing to capture: draw it settled.
 */
export const OfficeStepPreview = ({ step }: { step: PreviewStep }) => {
  const pluginApi = usePluginAPI();
  const { importData, localSlideIndex } = step.slide;
  const deck = hasOfficeSlideshow(importData) ? importData.office : null;
  const slide = deck?.slides[localSlideIndex];
  const timeline = useMemo(
    () => (slide ? compileTimeline(slide) : null),
    [slide],
  );
  const webpSupport = useWebPSupport();
  // Previews are small: the 640px copies are plenty
  const resolveNetwork = useMemo<ResolveImage | null>(
    () =>
      deck && webpSupport !== null
        ? officeImageResolver(deck, pluginApi.media, "preview")
        : null,
    [deck, webpSupport, pluginApi.media],
  );
  const deckUrls = useMemo(() => {
    if (!deck || !resolveNetwork) return NO_URLS;
    const urls = new Set<string>();
    for (const deckSlide of deck.slides) {
      for (const id of collectSlideImageIds(deckSlide)) {
        const image = resolveNetwork(id);
        if (image) urls.add(image.url);
      }
    }
    return [...urls];
  }, [deck, resolveNetwork]);
  const sprites = useSpriteStore({
    all: deckUrls,
    required: NO_URLS,
    decodeUrls: NO_URLS,
  });
  const resolveSprite = sprites.resolve;
  const resolveImage = useMemo<ResolveImage>(
    () => (imageId) => {
      const image = resolveNetwork?.(imageId);
      return image && { ...image, url: resolveSprite(image.url) };
    },
    [resolveNetwork, resolveSprite],
  );

  if (!deck || !slide || !timeline) return null;
  return (
    <div className="relative h-full w-full">
      <OfficeSlideView
        deck={deck}
        slide={slide}
        timeline={timeline}
        group={groupForClickCount(timeline, step.clickCount)}
        elapsedMs={SETTLED}
        resolveImage={resolveImage}
      />
    </div>
  );
};
