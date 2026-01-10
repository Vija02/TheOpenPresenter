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
    if (
      shouldAutoPlay &&
      calculatedAutoplaySlideIndex !== null &&
      calculatedAutoplaySlideIndex !== undefined
    ) {
      return calculatedAutoplaySlideIndex;
    }

    return baseIndex;
  }, [shouldAutoPlay, calculatedAutoplaySlideIndex, baseIndex]);

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
            width: "100vw",
            height: "100dvh",
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
