import {
  type LayoutVideoStates,
  type ScopedLayoutDoc,
  type VideoFillControl,
  activateVideoFills,
  audibleVideoElements,
  controlVideoFills,
  valtioVideoStateTarget,
  yjsVideoStateTarget,
} from "@repo/layout";

import { importedSlideVideoDoc, isCustomImport } from "../customSlides";
import {
  type DisplayMode,
  type PluginBaseData,
  type PluginRendererData,
  getEffectiveDisplayMode,
  isAnimatedDisplayMode,
} from "../types";
import { resolveSlide } from "./order";

type DisplayModes = Record<string, DisplayMode> | undefined;

const docsForSlide = (
  pluginData: PluginBaseData,
  slideIndex: number,
): ScopedLayoutDoc[] => {
  const resolved = resolveSlide(pluginData, slideIndex);
  if (!resolved) return [];

  const doc = isCustomImport(resolved.importData)
    ? resolved.importData.docs[resolved.localSlideIndex]
    : importedSlideVideoDoc(resolved.importData, resolved.localSlideIndex);
  if (!doc) return [];

  return [{ scope: resolved.rawRef, doc }];
};

/** An imported slide's videos */
const slideVideos = (
  pluginData: PluginBaseData,
  slideIndex: number,
  displayModes: DisplayModes,
) => {
  const resolved = resolveSlide(pluginData, slideIndex);
  if (!resolved || resolved.importData.type !== "googleslides") return null;

  const doc = importedSlideVideoDoc(
    resolved.importData,
    resolved.localSlideIndex,
  );
  if (!doc) return null;

  const clicks =
    resolved.importData.slideVideos?.[String(resolved.localSlideIndex)]
      ?.startClicks ?? {};
  const mode = getEffectiveDisplayMode(resolved.importData, displayModes);

  return {
    scope: resolved.rawRef,
    /** Shown as an image there are no clicks to wait for */
    hasClicks: isAnimatedDisplayMode(mode),
    videos: audibleVideoElements(doc).map((element) => ({
      elementId: element.id,
      startClick: clicks[element.id] ?? 0,
    })),
  };
};

// Adapter
export type ActivationTarget = {
  getVideoStates: () => LayoutVideoStates | undefined;
  setVideoStates: (next: LayoutVideoStates) => void;
  setSlideIndex: (index: number) => void;
  setClickCount: (count: number | null) => void;
  setLastClickTimestamp: (at: number) => void;
  getDisplayModes: () => DisplayModes;
};

export type ActivateSlideOptions = {
  clickCount?: number | null;
  now?: number;
  startLandedVideo?: boolean;
};

export const activateSlide = (
  target: ActivationTarget,
  pluginData: PluginBaseData,
  slideIndex: number,
  {
    clickCount = 0,
    now = Date.now(),
    startLandedVideo = true,
  }: ActivateSlideOptions = {},
): void => {
  target.setSlideIndex(slideIndex);
  target.setClickCount(clickCount);
  target.setLastClickTimestamp(now);

  activateVideoFills(target, docsForSlide(pluginData, slideIndex), now);

  const slide = slideVideos(pluginData, slideIndex, target.getDisplayModes());
  if (!slide) return;

  // Videos of earlier clicks stay waiting, or they'd all start at once
  const at = clickCount ?? 0;
  const controls = slide.videos.flatMap(
    ({ elementId, startClick }): VideoFillControl[] => {
      // From the top, whether starting or rewinding
      const control = (playing: boolean) => [
        { scope: slide.scope, elementId, playing, seek: 0 },
      ];
      if (!slide.hasClicks) return startClick > 0 ? control(true) : [];
      // -1 is the slide with its automatic objects peeled off
      if (startClick === 0) return at < 0 ? control(false) : [];
      return startLandedVideo && startClick === at ? control(true) : [];
    },
  );
  controlVideoFills(target, controls, now);
};

/**
 * A click within the slide: starts the videos it reaches, and rewinds the ones
 * it steps back before. Any other video is left as it is.
 */
export const updateSlideVideos = (
  target: Pick<
    ActivationTarget,
    "getVideoStates" | "setVideoStates" | "getDisplayModes"
  >,
  pluginData: PluginBaseData,
  slideIndex: number,
  { from, to }: { from: number; to: number },
  now: number = Date.now(),
): void => {
  const slide = slideVideos(pluginData, slideIndex, target.getDisplayModes());
  if (!slide?.hasClicks) return;

  const reached = (click: number, startClick: number) => click >= startClick;
  controlVideoFills(
    target,
    slide.videos
      .filter(
        ({ startClick }) =>
          reached(from, startClick) !== reached(to, startClick),
      )
      .map(({ elementId, startClick }) => ({
        scope: slide.scope,
        elementId,
        playing: reached(to, startClick),
        seek: 0,
      })),
    now,
  );
};

export const valtioActivationTarget = (
  mutableRendererData: PluginRendererData,
): ActivationTarget => ({
  ...valtioVideoStateTarget(mutableRendererData),
  setSlideIndex: (index) => {
    mutableRendererData.currentSlideIndex = index;
  },
  setClickCount: (count) => {
    mutableRendererData.currentClickCount = count;
  },
  setLastClickTimestamp: (at) => {
    mutableRendererData.lastClickTimestamp = at;
  },
  getDisplayModes: () => mutableRendererData.displayModes,
});

export const yjsActivationTarget = (rendererData: {
  get: (key: any) => any;
  set: (key: any, value: any) => any;
}): ActivationTarget => ({
  ...yjsVideoStateTarget(rendererData),
  setSlideIndex: (index) => {
    rendererData.set("currentSlideIndex", index);
  },
  setClickCount: (count) => {
    rendererData.set("currentClickCount", count);
  },
  setLastClickTimestamp: (at) => {
    rendererData.set("lastClickTimestamp", at);
  },
  getDisplayModes: () => {
    const raw = rendererData.get("displayModes");
    return typeof raw?.toJSON === "function" ? raw.toJSON() : raw;
  },
});
