import {
  type LayoutVideoStates,
  type ScopedLayoutDoc,
  activateVideoFills,
  valtioVideoStateTarget,
  yjsVideoStateTarget,
} from "@repo/layout";

import { resolveBibleDoc } from "./template/presets";
import type { PluginBaseData, PluginRendererData } from "./types";

export const verseScope = (passageId: string, slideIndex: number): string =>
  `${passageId}:${slideIndex}`;

const docsForVerse = (
  pluginData: PluginBaseData,
  passageId: string | null,
  slideIndex: number | null,
): ScopedLayoutDoc[] => {
  if (passageId === null || slideIndex === null) return [];

  return [
    {
      scope: verseScope(passageId, slideIndex),
      doc: resolveBibleDoc(pluginData.template),
    },
  ];
};

export type ActivationTarget = {
  getVideoStates: () => LayoutVideoStates | undefined;
  setVideoStates: (next: LayoutVideoStates) => void;
  setPassageId: (id: string | null) => void;
  setSlideIndex: (index: number | null) => void;
  setLastClickTimestamp: (at: number) => void;
};

export const activateVerse = (
  target: ActivationTarget,
  pluginData: PluginBaseData,
  passageId: string | null,
  slideIndex: number | null,
  now: number = Date.now(),
): void => {
  target.setPassageId(passageId);
  target.setSlideIndex(slideIndex);
  target.setLastClickTimestamp(now);

  activateVideoFills(
    target,
    docsForVerse(pluginData, passageId, slideIndex),
    now,
  );
};

export const valtioActivationTarget = (
  mutableRendererData: PluginRendererData,
): ActivationTarget => ({
  ...valtioVideoStateTarget(mutableRendererData),
  setPassageId: (id) => {
    mutableRendererData.passageId = id;
  },
  setSlideIndex: (index) => {
    mutableRendererData.slideIndex = index;
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
  setPassageId: (id) => {
    rendererData.set("passageId", id);
  },
  setSlideIndex: (index) => {
    rendererData.set("slideIndex", index);
  },
  setLastClickTimestamp: (at) => {
    rendererData.set("lastClickTimestamp", at);
  },
});
