import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { usePluginAPI } from "../pluginApi";
import RenderView, { RenderViewHandle } from "./RenderView";

const Renderer = ({
  shouldUpdateResolvedSlideIndex = false,
}: {
  shouldUpdateResolvedSlideIndex?: boolean;
}) => {
  const pluginApi = usePluginAPI();
  const fetchId = pluginApi.scene.useData((x) => x.pluginData.fetchId);
  if (!fetchId) {
    return null;
  }

  return (
    <RendererInner
      key={fetchId}
      shouldUpdateResolvedSlideIndex={shouldUpdateResolvedSlideIndex}
    />
  );
};

const RendererInner = ({
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

  const slideSrc = useMemo(() => {
    return (
      window.location.origin +
      `/plugin/google-slides/proxy?pluginId=${pluginApi.pluginContext.pluginId}`
    );
  }, [pluginApi.pluginContext.pluginId]);

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
      ref.current?.goToSlide(slideIndex ?? 0);
      update();
      setInitialized(true);
      setAwarenessStateData({ isLoading: false });
    }
  }, [initialized, loaded, setAwarenessStateData, slideIndex, update]);

  useEffect(() => {
    // TEST: Clicking on the same slideId as the current selected one should reset the click count
    if (initialized && clickCount === null) {
      ref.current?.goToSlide(slideIndex ?? 0);
      setLocalClickCount(0);
    }
  }, [clickCount, initialized, slideIndex]);

  useEffect(() => {
    if (initialized && clickCount !== localClickCount && clickCount !== null) {
      update();
    }
  }, [clickCount, initialized, localClickCount, update]);

  return (
    <RenderView
      ref={ref}
      key={slideSrc}
      src={slideSrc}
      onLoad={() => setLoaded(true)}
    />
  );
};

export default Renderer;
