import type { FeedDataContext } from "@repo/base-plugin/client";

import {
  IMPORT_NAME_BINDING,
  NOTES_BINDING,
  SLIDE_COUNT_BINDING,
  SLIDE_NUMBER_BINDING,
} from "../bindings";
import { OFFSET_PARAM } from "../derivation";
import {
  calculateAutoplayPosition,
  computeGlobalSlideClickCount,
  fromFlatPosition,
  toFlatPosition,
  totalStepCount,
} from "../slides/autoplay";
import { resolveSlide } from "../slides/order";

export const displayedSlideIndex = ({
  sceneData,
  rendererData,
  derivation,
}: FeedDataContext): number => {
  const pluginData = sceneData?.pluginData ?? {};
  const offset = Number(derivation?.params?.[OFFSET_PARAM] ?? 0);

  const globalSlideClickCount = computeGlobalSlideClickCount(
    pluginData,
    rendererData?.displayModes,
  );

  const autoplayPosition = rendererData?.autoplay?.enabled
    ? calculateAutoplayPosition({
        lastClickTimestamp: rendererData?.lastClickTimestamp ?? null,
        loopDurationMs: rendererData?.autoplay?.loopDurationMs ?? 10,
        baseIndex: rendererData?.currentSlideIndex ?? 0,
        baseClickCount: rendererData?.currentClickCount ?? 0,
        globalSlideClickCount,
      })
    : null;

  const baseIndex =
    autoplayPosition?.slideIndex ?? rendererData?.currentSlideIndex ?? 0;
  const baseClickCount =
    autoplayPosition?.clickCount ?? rendererData?.currentClickCount ?? 0;

  const flat =
    toFlatPosition(baseIndex, baseClickCount, globalSlideClickCount) + offset;

  if (flat < 0 || flat >= totalStepCount(globalSlideClickCount)) return -1;
  return fromFlatPosition(flat, globalSlideClickCount)?.slideIndex ?? -1;
};

/** Token values for a slides feed. */
export const getSlidesFeedData = (ctx: FeedDataContext) => {
  const pluginData = ctx.sceneData?.pluginData ?? {};
  const index = displayedSlideIndex(ctx);
  const resolved = index >= 0 ? resolveSlide(pluginData, index) : null;

  return {
    [NOTES_BINDING]:
      resolved?.importData.speakerNotes?.[resolved.localSlideIndex] ?? "",
    // Past the end of the deck there is no slide to number.
    [SLIDE_NUMBER_BINDING]: index >= 0 ? String(index + 1) : "",
    [SLIDE_COUNT_BINDING]: String(pluginData.slideOrder?.length ?? 0),
    [IMPORT_NAME_BINDING]: resolved?.importData.name ?? "",
  };
};
