import { useEffect, useMemo, useState } from "react";

import {
  AutoplayPosition,
  calculateAutoplayPosition,
} from "../../src/slides/autoplay";
import { usePluginAPI } from "../pluginApi";

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
