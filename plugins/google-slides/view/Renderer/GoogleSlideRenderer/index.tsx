import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { usePluginAPI } from "../../pluginApi";
import RenderView, { RenderViewHandle } from "./RenderView";

export const GoogleSlideRenderer = ({
  shouldUpdateResolvedSlideIndex = false,
}: {
  shouldUpdateResolvedSlideIndex?: boolean;
}) => {
  const ref = useRef<RenderViewHandle>(null);

  const [localClickCount, setLocalClickCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const pluginApi = usePluginAPI();
  const setAwarenessStateData = pluginApi.awareness.setAwarenessStateData;
  const slideIndex = pluginApi.renderer.useData((x) => x.slideIndex);
  const clickCount = pluginApi.renderer.useData((x) => x.clickCount);
  const mutableRendererData = pluginApi.renderer.useValtioData();

  const pageIds = pluginApi.scene.useData((x) => x.pluginData.pageIds);

  // Get derivation offset for confidence monitor mode
  const derivationOffset = pluginApi.renderer.useDerivationOffset();

  const slideSrc = useMemo(() => {
    return (
      window.location.origin +
      `/plugin/google-slides/proxy?pluginId=${pluginApi.pluginContext.pluginId}`
    );
  }, [pluginApi.pluginContext.pluginId]);

  // Calculate the derived slide index, applying offset for confidence monitor mode
  const derivedSlideIndex = useMemo(() => {
    const baseIndex = slideIndex ?? 0;
    if (derivationOffset === 0) {
      return baseIndex;
    }
    const newIndex = baseIndex + derivationOffset;
    // Return -1 if out of bounds (shows nothing)
    if (newIndex < 0 || newIndex >= pageIds.length) {
      return -1;
    }
    return newIndex;
  }, [slideIndex, derivationOffset, pageIds.length]);

  // Track if we're out of bounds due to derivation offset
  const isOutOfBounds = derivedSlideIndex === -1;

  const updateResolvedSlideIndex = useCallback(
    (newSlideId: string) => {
      const newSlideIndex = pageIds.findIndex((x) => x === newSlideId);
      mutableRendererData.resolvedSlideIndex = newSlideIndex;
    },
    [mutableRendererData, pageIds],
  );

  const update = useCallback(() => {
    if (clickCount !== null) {
      const offset = Math.abs(clickCount - localClickCount);

      Array.from(new Array(offset)).forEach(() => {
        if (clickCount > localClickCount) {
          setTimeout(() => {
            const newSlideId = ref.current?.next();
            // DEBT: We check if the offset is 1 because we don't want to run this on load
            // But maybe we can handle this better by checking the previous loaded state
            if (shouldUpdateResolvedSlideIndex && offset === 1 && newSlideId) {
              updateResolvedSlideIndex(newSlideId);
            }
          }, 50);
        } else {
          setTimeout(() => {
            const newSlideId = ref.current?.prev();
            if (shouldUpdateResolvedSlideIndex && offset === 1 && newSlideId) {
              updateResolvedSlideIndex(newSlideId);
            }
          }, 50);
        }
      });
      setLocalClickCount(clickCount);
    }
  }, [
    clickCount,
    localClickCount,
    shouldUpdateResolvedSlideIndex,
    updateResolvedSlideIndex,
  ]);

  useEffect(() => {
    setAwarenessStateData({ isLoading: true });
  }, [setAwarenessStateData]);

  useEffect(() => {
    if (loaded && !initialized) {
      if (!isOutOfBounds) {
        ref.current?.goToSlide(derivedSlideIndex);
        update();
      }
      setInitialized(true);
      setAwarenessStateData({ isLoading: false });
    }
  }, [
    initialized,
    loaded,
    setAwarenessStateData,
    derivedSlideIndex,
    isOutOfBounds,
    update,
  ]);

  useEffect(() => {
    // TEST: Clicking on the same slideId as the current selected one should reset the click count
    if (initialized && clickCount === null) {
      if (!isOutOfBounds) {
        ref.current?.goToSlide(derivedSlideIndex);
      }
      setLocalClickCount(0);
    }
  }, [clickCount, initialized, derivedSlideIndex, isOutOfBounds]);

  useEffect(() => {
    if (initialized && clickCount !== localClickCount && clickCount !== null) {
      update();
    }
  }, [clickCount, initialized, localClickCount, update]);

  // When out of bounds due to derivation offset, render nothing
  if (isOutOfBounds) {
    return null;
  }

  return (
    <RenderView
      ref={ref}
      key={slideSrc}
      src={slideSrc}
      onLoad={() => setLoaded(true)}
    />
  );
};
