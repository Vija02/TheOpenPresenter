import { useMemo } from "react";

import { resolveSlide } from "../../src/slideOrderUtils";
import { ResolvedSlide } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import {
  computeGlobalSlideClickCount,
  fromFlatPosition,
  toFlatPosition,
  totalStepCount,
  useAutoplay,
} from "./useAutoplay";

export type DisplayedSlide = {
  resolvedSlide: ResolvedSlide | null;
  globalSlideIndex: number;
  clickCount: number;
};

export const useDisplayedSlide = (): DisplayedSlide => {
  const pluginApi = usePluginAPI();
  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const currentSlideIndex = pluginApi.renderer.useData(
    (x) => x.currentSlideIndex,
  );
  const currentClickCount = pluginApi.renderer.useData(
    (x) => x.currentClickCount,
  );
  const displayModes = pluginApi.renderer.useData((x) => x.displayModes);
  const derivationOffset = pluginApi.renderer.useDerivationOffset();

  const baseIndex = currentSlideIndex ?? 0;
  const baseClickCount = currentClickCount ?? 0;

  const globalSlideClickCount = useMemo(
    () => computeGlobalSlideClickCount(pluginData, displayModes),
    [pluginData, displayModes],
  );

  const {
    shouldAutoPlay,
    calculatedAutoplaySlideIndex,
    calculatedAutoplayClickCount,
  } = useAutoplay({
    baseIndex,
    baseClickCount,
    globalSlideClickCount,
  });

  const effectiveIndex = useMemo(
    () =>
      shouldAutoPlay && calculatedAutoplaySlideIndex !== null
        ? calculatedAutoplaySlideIndex
        : baseIndex,
    [shouldAutoPlay, calculatedAutoplaySlideIndex, baseIndex],
  );

  const effectiveClickCount = useMemo(
    () =>
      shouldAutoPlay && calculatedAutoplayClickCount !== null
        ? calculatedAutoplayClickCount
        : baseClickCount,
    [shouldAutoPlay, calculatedAutoplayClickCount, baseClickCount],
  );

  const baseFlatPos = useMemo(
    () =>
      toFlatPosition(
        effectiveIndex,
        effectiveClickCount,
        globalSlideClickCount,
      ),
    [effectiveIndex, effectiveClickCount, globalSlideClickCount],
  );

  const derivedFlatPos = useMemo(
    () => baseFlatPos + derivationOffset,
    [baseFlatPos, derivationOffset],
  );

  const totalSteps = useMemo(
    () => totalStepCount(globalSlideClickCount),
    [globalSlideClickCount],
  );

  const derivedPosition = useMemo(
    () =>
      derivedFlatPos < 0 || derivedFlatPos >= totalSteps
        ? null
        : fromFlatPosition(derivedFlatPos, globalSlideClickCount),
    [derivedFlatPos, totalSteps, globalSlideClickCount],
  );

  const resolvedSlide = useMemo(() => {
    if (!derivedPosition) return null;
    return resolveSlide(pluginData, derivedPosition.slideIndex);
  }, [pluginData, derivedPosition]);

  return useMemo<DisplayedSlide>(
    () => ({
      resolvedSlide,
      globalSlideIndex: derivedPosition?.slideIndex ?? -1,
      clickCount: derivedPosition?.clickCount ?? 0,
    }),
    [resolvedSlide, derivedPosition],
  );
};
