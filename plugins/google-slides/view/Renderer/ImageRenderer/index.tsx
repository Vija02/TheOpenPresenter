import { useCallback, useEffect, useMemo, useRef } from "react";

import { resolveSlide } from "../../../src/slideOrderUtils";
import { ResolvedSlide, getEffectiveDisplayMode } from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { useDisplayedSlide } from "../../utils/useDisplayedSlide";
import { ImageRenderView } from "./ImageRenderView";

const IMAGE_RENDERER_ID = "__image_renderer__";

interface ImageRendererProps {
  onLoadingChange: (id: string, isLoading: boolean) => void;
}

export const ImageRenderer = ({ onLoadingChange }: ImageRendererProps) => {
  const pluginApi = usePluginAPI();
  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const rendererDisplayModes = pluginApi.renderer.useData(
    (x) => x.displayModes,
  );

  const { globalSlideIndex } = useDisplayedSlide();

  const renderableSlides = useMemo(() => {
    const slides: { slide: ResolvedSlide; globalIndex: number }[] = [];
    for (let i = 0; i < pluginData.slideOrder.length; i++) {
      const resolved = resolveSlide(pluginData, i);
      if (!resolved) continue;
      if (!resolved.thumbnailUrl) continue;
      const mode = getEffectiveDisplayMode(
        resolved.importData,
        rendererDisplayModes,
      );
      // Only render slides that has the image display mode
      if (mode !== "image") continue;
      slides.push({ slide: resolved, globalIndex: i });
    }
    return slides;
  }, [pluginData, rendererDisplayModes]);

  const loadedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const validIds = new Set(renderableSlides.map(({ slide }) => slide.rawRef));
    for (const id of loadedIds.current) {
      if (!validIds.has(id)) loadedIds.current.delete(id);
    }
  }, [renderableSlides]);

  const onLoad = useCallback(
    (slideId: string) => {
      loadedIds.current.add(slideId);

      const allLoaded = renderableSlides.every(({ slide }) =>
        loadedIds.current.has(slide.rawRef),
      );
      onLoadingChange(IMAGE_RENDERER_ID, !allLoaded);
    },
    [renderableSlides, onLoadingChange],
  );

  return renderableSlides.map(({ slide, globalIndex }) => {
    const isActive = globalSlideIndex === globalIndex;
    return (
      <div
        key={slide.rawRef}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          opacity: isActive ? 1 : 0,
        }}
      >
        <ImageRenderView
          src={slide.thumbnailUrl}
          isActive={isActive}
          onLoad={() => onLoad(slide.rawRef)}
        />
      </div>
    );
  });
};
