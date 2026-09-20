import { DisplayMode, PluginBaseData, getEffectiveDisplayMode } from "../types";
import { resolveSlide } from "./order";

export type AutoplayPosition = {
  slideIndex: number;
  clickCount: number;
};

export const computeGlobalSlideClickCount = (
  pluginData: PluginBaseData,
  displayModes: Record<string, DisplayMode> | undefined,
): number[] => {
  const result: number[] = [];
  const slideOrder = pluginData.slideOrder ?? [];
  for (let i = 0; i < slideOrder.length; i++) {
    const resolved = resolveSlide(pluginData, i);
    if (!resolved) {
      result.push(0);
      continue;
    }
    const mode = getEffectiveDisplayMode(resolved.importData, displayModes);
    result.push(mode === "googleslides" ? resolved.clickCount : 0);
  }
  return result;
};

export const totalStepCount = (globalSlideClickCount: number[]): number =>
  globalSlideClickCount.reduce((sum, n) => sum + n + 1, 0);

export const toFlatPosition = (
  slideIndex: number,
  clickCount: number,
  globalSlideClickCount: number[],
): number => {
  if (globalSlideClickCount.length === 0) return 0;
  const safeIndex = Math.min(
    Math.max(0, slideIndex),
    globalSlideClickCount.length - 1,
  );
  let pos = 0;
  for (let i = 0; i < safeIndex; i++) {
    pos += (globalSlideClickCount[i] ?? 0) + 1;
  }
  const slideStepCount = globalSlideClickCount[safeIndex] ?? 0;
  pos += Math.min(Math.max(0, clickCount), slideStepCount);
  return pos;
};

export const fromFlatPosition = (
  pos: number,
  globalSlideClickCount: number[],
): AutoplayPosition | null => {
  if (pos < 0) return null;
  let remaining = pos;
  for (let i = 0; i < globalSlideClickCount.length; i++) {
    const stepCount = (globalSlideClickCount[i] ?? 0) + 1;
    if (remaining < stepCount) {
      return { slideIndex: i, clickCount: remaining };
    }
    remaining -= stepCount;
  }
  return null;
};

export const calculateAutoplayPosition = ({
  lastClickTimestamp,
  loopDurationMs,
  baseIndex,
  baseClickCount,
  globalSlideClickCount,
}: {
  lastClickTimestamp: number | null;
  loopDurationMs: number;
  baseIndex: number;
  baseClickCount: number;
  globalSlideClickCount: number[];
}): AutoplayPosition => {
  if (globalSlideClickCount.length === 0 || lastClickTimestamp === null) {
    return { slideIndex: baseIndex, clickCount: baseClickCount };
  }

  const total = totalStepCount(globalSlideClickCount);
  const basePos = toFlatPosition(
    baseIndex,
    baseClickCount,
    globalSlideClickCount,
  );

  const elapsed = Math.max(0, Date.now() - lastClickTimestamp);
  const stepDelta = Math.floor(elapsed / loopDurationMs);
  const newPos = (basePos + stepDelta) % total;

  return (
    fromFlatPosition(newPos, globalSlideClickCount) ?? {
      slideIndex: 0,
      clickCount: 0,
    }
  );
};

export const calculateAutoplayStepStartedAt = ({
  lastClickTimestamp,
  loopDurationMs,
}: {
  lastClickTimestamp: number | null;
  loopDurationMs: number;
}): number | null => {
  if (lastClickTimestamp === null || loopDurationMs <= 0) return null;

  const elapsed = Math.max(0, Date.now() - lastClickTimestamp);
  const stepDelta = Math.floor(elapsed / loopDurationMs);

  return lastClickTimestamp + stepDelta * loopDurationMs;
};
