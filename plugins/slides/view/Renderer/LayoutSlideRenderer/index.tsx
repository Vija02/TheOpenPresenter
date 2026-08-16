import type { LayoutDoc } from "@repo/layout";
import { LayoutRenderer } from "@repo/layout/react";
import { useMemo } from "react";

import { resolveSlide } from "../../../src/slideOrderUtils";
import { ResolvedSlide, getEffectiveDisplayMode } from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { useDisplayedSlide } from "../../utils/useDisplayedSlide";

const EMPTY_DATA = {};

type RenderableCustomSlide = {
  slide: ResolvedSlide;
  globalIndex: number;
  doc: LayoutDoc;
};

export const LayoutSlideRenderer = () => {
  const pluginApi = usePluginAPI();
  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const rendererDisplayModes = pluginApi.renderer.useData(
    (x) => x.displayModes,
  );

  const { globalSlideIndex } = useDisplayedSlide();

  const totalSlides = pluginData.slideOrder?.length ?? 0;

  const renderableSlides = useMemo(() => {
    const slides: RenderableCustomSlide[] = [];

    for (let i = 0; i < (pluginData.slideOrder?.length ?? 0); i++) {
      const resolved = resolveSlide(pluginData, i);
      if (!resolved) continue;

      const importData = resolved.importData;
      if (importData.type !== "custom") continue;
      if (
        getEffectiveDisplayMode(importData, rendererDisplayModes) !== "layout"
      ) {
        continue;
      }

      const doc = importData.docs[resolved.localSlideIndex];
      if (!doc) continue;

      slides.push({ slide: resolved, globalIndex: i, doc });
    }

    return slides;
  }, [pluginData, rendererDisplayModes]);

  return renderableSlides.map(({ slide, globalIndex, doc }) => {
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
        <LayoutRenderer
          doc={doc}
          data={EMPTY_DATA}
          frame={{ index: globalIndex + 1, total: totalSlides }}
        />
      </div>
    );
  });
};
