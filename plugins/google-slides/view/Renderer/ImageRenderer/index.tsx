import { useCallback, useEffect, useMemo, useRef } from "react";

import { usePluginAPI } from "../../pluginApi";
import { calculateBaseSlideIndex } from "../../utils/slideIndex";
import { useAutoplay } from "../../utils/useAutoplay";
import { ImageRenderView } from "./ImageRenderView";

export const ImageRenderer = () => {
  const pluginApi = usePluginAPI();
  const slideIndex = pluginApi.renderer.useData((x) => x.slideIndex);
  const clickCount = pluginApi.renderer.useData((x) => x.clickCount);

  const thumbnailLinks = pluginApi.scene.useData(
    (x) => x.pluginData.thumbnailLinks,
  );

  // Get derivation offset for confidence monitor mode
  const derivationOffset = pluginApi.renderer.useDerivationOffset();

  const baseIndex = useMemo(
    () =>
      calculateBaseSlideIndex({
        slideIndex,
        clickCount,
        slideCount: thumbnailLinks.length,
      }),
    [clickCount, slideIndex, thumbnailLinks.length],
  );

  const { shouldAutoPlay, calculatedAutoplaySlideIndex } =
    useAutoplay(baseIndex);

  const activeIndex = useMemo(() => {
    let index: number;
    if (
      shouldAutoPlay &&
      calculatedAutoplaySlideIndex !== null &&
      calculatedAutoplaySlideIndex !== undefined
    ) {
      index = calculatedAutoplaySlideIndex;
    } else {
      index = baseIndex;
    }

    // Apply derivation offset
    if (derivationOffset !== 0) {
      const derivedIndex = index + derivationOffset;
      // Return -1 if out of bounds (shows nothing)
      if (derivedIndex < 0 || derivedIndex >= thumbnailLinks.length) {
        return -1;
      }
      return derivedIndex;
    }

    return index;
  }, [
    shouldAutoPlay,
    calculatedAutoplaySlideIndex,
    baseIndex,
    derivationOffset,
    thumbnailLinks.length,
  ]);

  const setAwarenessStateData = pluginApi.awareness.setAwarenessStateData;

  useEffect(() => {
    setAwarenessStateData({ isLoading: true });
  }, [setAwarenessStateData]);

  const loadedCount = useRef(0);

  const onLoad = useCallback(() => {
    loadedCount.current++;

    if (loadedCount.current === thumbnailLinks.length) {
      pluginApi.awareness.setAwarenessStateData({ isLoading: false });
    }
  }, [pluginApi.awareness, thumbnailLinks.length]);

  return thumbnailLinks.map(
    (imgSrc, i) =>
      imgSrc &&
      imgSrc !== "" && (
        <div
          key={imgSrc}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            opacity: activeIndex === i ? 1 : 0,
          }}
        >
          <ImageRenderView
            src={imgSrc}
            isActive={activeIndex === i}
            onLoad={onLoad}
          />
        </div>
      ),
  );
};
