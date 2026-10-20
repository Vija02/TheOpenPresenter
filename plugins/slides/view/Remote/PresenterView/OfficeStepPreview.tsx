import { useMemo } from "react";

import { SETTLED } from "../../../src/office/evaluate";
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
import { usePluginAPI } from "../../pluginApi";
import type { PreviewStep } from "./SidePreviews";

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
  const resolveImage = useMemo<ResolveImage>(
    // Previews are small: the 640px copies are plenty
    () =>
      deck
        ? officeImageResolver(deck, pluginApi.media, "preview")
        : () => undefined,
    [deck, pluginApi.media],
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
