import { LayoutRenderer } from "@repo/layout/react";
import { Button, Slide, SlideGrid } from "@repo/ui";
import { useEffect, useMemo } from "react";
import { FaTimes } from "react-icons/fa";

import { resolvedSlideDoc } from "../../../src/customSlides";
import { resolveSlide } from "../../../src/slides/order";
import type { ResolvedSlide } from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { aspectRatioValue, slideAspectRatio } from "./slideGeometry";

/**
 * Every slide at once, like the slide list on the remote's front page. Picking
 * one goes to it and closes the overview.
 */
export const SlideOverview = ({
  currentSlide,
  onSelect,
  onClose,
}: {
  currentSlide: number;
  onSelect: (slide: ResolvedSlide) => void;
  onClose: () => void;
}) => {
  const pluginApi = usePluginAPI();
  const pluginData = pluginApi.scene.useData((x) => x.pluginData);

  const slides = useMemo(
    () =>
      (pluginData.slideOrder ?? [])
        .map((_, i) => resolveSlide(pluginData, i))
        .filter((x) => !!x),
    [pluginData],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label="All slides"
      data-testid="speaker-slide-overview"
      className="fixed inset-0 z-50 flex flex-col bg-surface-primary"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stroke px-3 py-2 sm:px-4">
        <h2 className="text-sm font-medium">All slides</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          title="Close all slides"
          aria-label="Close all slides"
        >
          <FaTimes />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        <SlideGrid pluginAPI={pluginApi}>
          {slides.map((slide) => (
            <Slide
              key={slide.rawRef}
              pluginAPI={pluginApi}
              heading={`Slide ${slide.globalSlideIndex + 1}`}
              isActive={slide.globalSlideIndex === currentSlide}
              aspectRatio={aspectRatioValue(slideAspectRatio(slide))}
              onClick={() => {
                onSelect(slide);
                onClose();
              }}
            >
              <div className="h-full w-full bg-black">
                <LayoutRenderer
                  doc={resolvedSlideDoc(slide)}
                  data={{}}
                  frame={{
                    index: slide.globalSlideIndex + 1,
                    total: slides.length,
                  }}
                />
              </div>
            </Slide>
          ))}
        </SlideGrid>
      </div>
    </div>
  );
};
