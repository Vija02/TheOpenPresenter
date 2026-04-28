import { useEffect, useMemo, useState } from "react";

import { resolveSlide } from "../../src/slideOrderUtils";
import {
  DisplayMode,
  PluginBaseData,
  getEffectiveDisplayMode,
} from "../../src/types";
import { usePluginAPI } from "../pluginApi";

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

  const totalSteps = globalSlideClickCount.reduce((sum, n) => sum + n + 1, 0);

  // Convert (baseIndex, baseClickCount) to a flat step position.
  let basePos = 0;
  const safeBaseIndex = Math.min(
    Math.max(0, baseIndex),
    globalSlideClickCount.length - 1,
  );
  for (let i = 0; i < safeBaseIndex; i++) {
    basePos += (globalSlideClickCount[i] ?? 0) + 1;
  }
  const baseSlideClickCount = globalSlideClickCount[safeBaseIndex] ?? 0;
  basePos += Math.min(Math.max(0, baseClickCount), baseSlideClickCount);

  const elapsed = Math.max(0, Date.now() - lastClickTimestamp);
  const stepDelta = Math.floor(elapsed / loopDurationMs);
  const newPos = (basePos + stepDelta) % totalSteps;

  // Convert flat position back to (slideIndex, clickCount).
  let remaining = newPos;
  for (let i = 0; i < globalSlideClickCount.length; i++) {
    const stepCount = (globalSlideClickCount[i] ?? 0) + 1;
    if (remaining < stepCount) {
      return { slideIndex: i, clickCount: remaining };
    }
    remaining -= stepCount;
  }

  return { slideIndex: 0, clickCount: 0 };
};

export const useAutoplay = ({
  baseIndex,
  baseClickCount,
  globalSlideClickCount,
}: {
  baseIndex: number;
  baseClickCount: number;
  globalSlideClickCount: number[];
}) => {
  const pluginApi = usePluginAPI();
  const autoplay = pluginApi.renderer.useData((x) => x.autoplay);
  const lastClickTimestamp = pluginApi.renderer.useData(
    (x) => x.lastClickTimestamp,
  );
  const loopDurationMs = useMemo(
    () => autoplay?.loopDurationMs ?? 10,
    [autoplay?.loopDurationMs],
  );
  const shouldAutoPlay = useMemo(
    () =>
      !!autoplay?.enabled && loopDurationMs > 0 && lastClickTimestamp !== null,
    [autoplay?.enabled, lastClickTimestamp, loopDurationMs],
  );

  const [position, setPosition] = useState<AutoplayPosition | null>(null);

  useEffect(() => {
    if (!shouldAutoPlay) {
      return;
    }

    let frameId: number;
    const tick = () => {
      const newPos = calculateAutoplayPosition({
        lastClickTimestamp,
        loopDurationMs,
        baseIndex,
        baseClickCount,
        globalSlideClickCount,
      });
      setPosition(newPos);

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [
    baseIndex,
    baseClickCount,
    lastClickTimestamp,
    loopDurationMs,
    shouldAutoPlay,
    globalSlideClickCount,
  ]);

  return {
    shouldAutoPlay,
    loopDurationMs,
    calculatedAutoplaySlideIndex: position?.slideIndex ?? null,
    calculatedAutoplayClickCount: position?.clickCount ?? null,
  };
};
