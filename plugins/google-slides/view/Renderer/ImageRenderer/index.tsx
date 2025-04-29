import { useCallback, useEffect, useMemo, useRef } from "react";

import { usePluginAPI } from "../../pluginApi";
import { ImageRenderView } from "./ImageRenderView";

export const ImageRenderer = () => {
  const pluginApi = usePluginAPI();
  const slideIndex = pluginApi.renderer.useData((x) => x.slideIndex);
  const clickCount = pluginApi.renderer.useData((x) => x.clickCount);

  const thumbnailLinks = pluginApi.scene.useData(
    (x) => x.pluginData.thumbnailLinks,
  );

  const activeIndex = useMemo(
    () => (slideIndex ?? 0) + (clickCount ?? 0),
    [clickCount, slideIndex],
  );

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
            height: "100vh",
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
