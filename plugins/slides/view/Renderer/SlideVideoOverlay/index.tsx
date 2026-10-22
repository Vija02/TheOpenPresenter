import type { LayoutDoc } from "@repo/layout";
import { LayoutRenderer } from "@repo/layout/react";
import { useMemo } from "react";

import { importedSlideVideoDoc } from "../../../src/customSlides";
import { resolveSlide } from "../../../src/slides/order";
import { ResolvedSlide } from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { useDisplayedSlide } from "../../utils/useDisplayedSlide";

const EMPTY_DATA = {};

type VideoOverlay = {
  slide: ResolvedSlide;
  globalIndex: number;
  doc: LayoutDoc;
};

/**
 * Plays the videos of imported slides over them, whatever draws the slide
 * itself. See `slideVideoDocs`.
 */
export const SlideVideoOverlay = () => {
  const pluginApi = usePluginAPI();
  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const { globalSlideIndex, activeSince } = useDisplayedSlide();

  const totalSlides = pluginData.slideOrder?.length ?? 0;

  const overlays = useMemo(() => {
    const result: VideoOverlay[] = [];

    for (let i = 0; i < (pluginData.slideOrder?.length ?? 0); i++) {
      const resolved = resolveSlide(pluginData, i);
      if (!resolved || resolved.importData._isFetching) continue;

      const doc = importedSlideVideoDoc(
        resolved.importData,
        resolved.localSlideIndex,
      );
      if (!doc) continue;

      result.push({ slide: resolved, globalIndex: i, doc });
    }

    return result;
  }, [pluginData]);

  return (
    <>
      {overlays.map(({ slide, globalIndex, doc }) => {
        // Each holds players; neighbours stay mounted so the next is preloaded
        if (
          globalSlideIndex < 0 ||
          Math.abs(globalIndex - globalSlideIndex) > 1
        ) {
          return null;
        }
        const isActive = globalSlideIndex === globalIndex;

        return (
          <div
            key={slide.rawRef}
            style={{
              position: "absolute",
              inset: 0,
              opacity: isActive ? 1 : 0,
              pointerEvents: "none",
            }}
          >
            <LayoutRenderer
              doc={doc}
              data={EMPTY_DATA}
              frame={{ index: globalIndex + 1, total: totalSlides }}
              activeSince={isActive ? activeSince : null}
              scope={slide.rawRef}
            />
          </div>
        );
      })}
    </>
  );
};
