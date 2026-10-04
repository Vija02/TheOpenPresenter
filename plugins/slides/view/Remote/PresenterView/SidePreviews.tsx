import useSize from "@react-hook/size";
import { LayoutRenderer } from "@repo/layout/react";
import { cx } from "class-variance-authority";
import { useEffect, useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

import { resolvedSlideDoc } from "../../../src/customSlides";
import { getEffectiveDisplayMode } from "../../../src/types";
import type { ResolvedSlide } from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { useSlideCapture } from "./capture/useSlideCapture";
import { aspectRatioValue, slideAspectRatio } from "./slideGeometry";

export type PreviewStep = { slide: ResolvedSlide; clickCount: number };

type Direction = "previous" | "next";

const DIRECTION_ICON: Record<Direction, React.ReactNode> = {
  previous: <FaChevronLeft />,
  next: <FaChevronRight />,
};

const EDGE_LABEL: Record<Direction, string> = {
  previous: "Start of slides",
  next: "End of slides",
};

const EMPTY_DATA = {};

export const SidePreviews = ({
  fillWidth,
  currentSlide,
  previous,
  next,
  onSelect,
}: {
  fillWidth: boolean;
  currentSlide: ResolvedSlide | null;
  previous: PreviewStep | null;
  next: PreviewStep | null;
  onSelect: (step: PreviewStep) => void;
}) => (
  <div
    className={cx(
      "mt-3 flex gap-3",
      fillWidth ? "shrink-0" : "min-h-[35%] flex-1",
    )}
  >
    <SidePreview
      label="Previous"
      direction="previous"
      currentSlide={currentSlide}
      step={previous}
      fillWidth={fillWidth}
      onSelect={onSelect}
    />
    <SidePreview
      label="Next"
      direction="next"
      currentSlide={currentSlide}
      step={next}
      fillWidth={fillWidth}
      onSelect={onSelect}
    />
  </div>
);

const SidePreview = ({
  label,
  direction,
  currentSlide,
  step,
  fillWidth,
  onSelect,
}: {
  label: string;
  direction: Direction;
  currentSlide: ResolvedSlide | null;
  step: PreviewStep | null;
  fillWidth: boolean;
  onSelect: (step: PreviewStep) => void;
}) => {
  const slide = step?.slide ?? null;
  const [areaElement, setAreaElement] = useState<HTMLDivElement | null>(null);
  const [labelElement, setLabelElement] = useState<HTMLDivElement | null>(null);
  const [areaWidth, areaHeight] = useSize(areaElement);
  const [, labelHeight] = useSize(labelElement);

  const ratio = aspectRatioValue(slideAspectRatio(slide ?? currentSlide));
  const availableHeight = Math.max(0, areaHeight - labelHeight);
  // In portrait the row has no height of its own, so size from the width.
  const width = fillWidth
    ? areaWidth
    : Math.min(areaWidth, availableHeight * ratio);
  const height = width / ratio;

  return (
    <div
      ref={setAreaElement}
      className="flex min-h-0 min-w-0 flex-1 justify-center"
    >
      <button
        type="button"
        disabled={!slide}
        onClick={() => step && onSelect(step)}
        style={{ width }}
        className={cx(
          "group flex flex-col self-start text-left",
          slide ? "cursor-pointer" : "cursor-default",
        )}
      >
        <div
          data-testid={`speaker-${direction}-box`}
          className={cx(
            "relative overflow-hidden ring-1 transition-shadow",
            slide
              ? "bg-black ring-stroke group-hover:ring-stroke-emphasis"
              : "bg-surface-secondary ring-stroke",
          )}
          style={{ width, height }}
        >
          {step ? (
            <StepPicture step={step} scope={`speaker-view-${direction}`} />
          ) : (
            currentSlide && (
              <div className="flex h-full w-full items-center justify-center p-2 text-center text-sm text-tertiary">
                {EDGE_LABEL[direction]}
              </div>
            )
          )}
        </div>
        <div
          ref={setLabelElement}
          className="flex w-full items-center justify-between gap-2 pt-1.5 text-xs text-secondary"
        >
          <span className="flex items-center gap-1.5 truncate">
            {DIRECTION_ICON[direction]}
            {label}
          </span>
          {step && (
            <span className="shrink-0 tabular-nums text-tertiary">
              {step.slide.globalSlideIndex + 1}
            </span>
          )}
        </div>
      </button>
    </div>
  );
};

/**
 * The step as it looks once finished: captured from the Google Slides embed
 * when ready, otherwise the slide's thumbnail.
 */
const StepPicture = ({ step, scope }: { step: PreviewStep; scope: string }) => {
  const pluginApi = usePluginAPI();
  const displayModes = pluginApi.renderer.useData((x) => x.displayModes);
  const { importData, localSlideIndex } = step.slide;
  const capture = useSlideCapture(
    importData.type === "googleslides" &&
      getEffectiveDisplayMode(importData, displayModes) === "googleslides"
      ? {
          fetchId: importData.fetchId,
          localSlideIndex,
          clickCount: step.clickCount,
        }
      : null,
  );

  if (capture) return <CapturedSvg svg={capture} />;
  return (
    <LayoutRenderer
      doc={resolvedSlideDoc(step.slide)}
      data={EMPTY_DATA}
      scope={scope}
    />
  );
};

const CapturedSvg = ({ svg }: { svg: SVGSVGElement }) => {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!container) return;
    // The store keeps the original, ready for the next time it is shown
    const copy = svg.cloneNode(true) as SVGSVGElement;
    copy.style.width = "100%";
    copy.style.height = "100%";
    copy.style.display = "block";
    container.replaceChildren(copy);
    return () => {
      container.replaceChildren();
    };
  }, [container, svg]);

  return (
    <div
      ref={setContainer}
      data-testid="speaker-captured-step"
      className="h-full w-full"
    />
  );
};
