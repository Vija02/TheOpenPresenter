import {
  type LayoutVideoStates,
  type ScopedLayoutDoc,
  activateVideoFills,
  valtioVideoStateTarget,
  yjsVideoStateTarget,
} from "@repo/layout";

import { isCustomImport } from "./customSlides";
import { resolveSlide } from "./slideOrderUtils";
import type { PluginBaseData, PluginRendererData } from "./types";

const docsForSlide = (
  pluginData: PluginBaseData,
  slideIndex: number,
): ScopedLayoutDoc[] => {
  const resolved = resolveSlide(pluginData, slideIndex);
  if (!resolved || !isCustomImport(resolved.importData)) return [];

  const doc = resolved.importData.docs[resolved.localSlideIndex];
  if (!doc) return [];

  return [{ scope: resolved.rawRef, doc }];
};

// Adapter
export type ActivationTarget = {
  getVideoStates: () => LayoutVideoStates | undefined;
  setVideoStates: (next: LayoutVideoStates) => void;
  setSlideIndex: (index: number) => void;
  setClickCount: (count: number | null) => void;
  setLastClickTimestamp: (at: number) => void;
};

export type ActivateSlideOptions = {
  clickCount?: number | null;
  now?: number;
};

export const activateSlide = (
  target: ActivationTarget,
  pluginData: PluginBaseData,
  slideIndex: number,
  { clickCount = 0, now = Date.now() }: ActivateSlideOptions = {},
): void => {
  target.setSlideIndex(slideIndex);
  target.setClickCount(clickCount);
  target.setLastClickTimestamp(now);

  activateVideoFills(target, docsForSlide(pluginData, slideIndex), now);
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
});
