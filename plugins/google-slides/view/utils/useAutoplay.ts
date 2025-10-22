import { useEffect, useMemo, useState } from "react";

import { usePluginAPI } from "../pluginApi";

export const calculateSlideIndexFromAutoplay = ({
  lastClickTimestamp,
  loopDurationMs,
  baseIndex,
  slideCount,
}: {
  lastClickTimestamp: number | null;
  loopDurationMs: number;
  baseIndex: number;
  slideCount: number;
}) => {
  const elapsed = Math.max(0, Date.now() - lastClickTimestamp!);
  const steps = Math.floor(elapsed / loopDurationMs);

  return (baseIndex + (steps % slideCount)) % slideCount;
};

export const useAutoplay = (baseIndex: number) => {
  const pluginApi = usePluginAPI();
  const autoplay = pluginApi.renderer.useData((x) => x.autoplay);
  const lastClickTimestamp = pluginApi.renderer.useData(
    (x) => x.lastClickTimestamp,
  );
  const thumbnailLinks = pluginApi.scene.useData(
    (x) => x.pluginData.thumbnailLinks,
  );
  const slideCount = useMemo(
    () => thumbnailLinks.length,
    [thumbnailLinks.length],
  );

  // Handle autoplay
  const loopDurationMs = useMemo(
    () => autoplay?.loopDurationMs ?? 10,
    [autoplay?.loopDurationMs],
  );
  const shouldAutoPlay = useMemo(
    () =>
      !!autoplay?.enabled &&
      loopDurationMs > 0 &&
      slideCount > 0 &&
      lastClickTimestamp !== null,
    [autoplay?.enabled, lastClickTimestamp, loopDurationMs, slideCount],
  );

  const [calculatedAutoplaySlideIndex, setCalculatedAutoplaySlideIndex] =
    useState<number | null>(null);

  useEffect(() => {
    if (!shouldAutoPlay) {
      return;
    }

    let frameId: number;
    const tick = () => {
      const newIndex = calculateSlideIndexFromAutoplay({
        lastClickTimestamp,
        loopDurationMs,
        baseIndex,
        slideCount,
      });
      setCalculatedAutoplaySlideIndex(newIndex);

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
    lastClickTimestamp,
    loopDurationMs,
    shouldAutoPlay,
    slideCount,
  ]);

  return { shouldAutoPlay, loopDurationMs, calculatedAutoplaySlideIndex };
};
