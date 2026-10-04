import useSize from "@react-hook/size";
import { LayoutRenderer } from "@repo/layout/react";
import { cx } from "class-variance-authority";
import { useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

import { resolvedSlideDoc } from "../../../src/customSlides";
import type { ResolvedSlide } from "../../../src/types";
import { aspectRatioValue, slideAspectRatio } from "./slideGeometry";

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
  previousSlide,
  nextSlide,
  onSelect,
}: {
  fillWidth: boolean;
  currentSlide: ResolvedSlide | null;
  previousSlide: ResolvedSlide | null;
  nextSlide: ResolvedSlide | null;
  onSelect: (slide: ResolvedSlide) => void;
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
      slide={previousSlide}
      fillWidth={fillWidth}
      onSelect={onSelect}
    />
    <SidePreview
      label="Next"
      direction="next"
      currentSlide={currentSlide}
      slide={nextSlide}
      fillWidth={fillWidth}
      onSelect={onSelect}
    />
  </div>
);

const SidePreview = ({
  label,
  direction,
  currentSlide,
  slide,
  fillWidth,
  onSelect,
}: {
  label: string;
  direction: Direction;
  currentSlide: ResolvedSlide | null;
  slide: ResolvedSlide | null;
  fillWidth: boolean;
  onSelect: (slide: ResolvedSlide) => void;
}) => {
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
        onClick={() => slide && onSelect(slide)}
        style={{ width }}
        className={cx(
          "group flex flex-col self-start text-left",
          slide ? "cursor-pointer" : "cursor-default",
        )}
      >
        <div
          data-testid={`speaker-${direction}-box`}
          className={cx(
            "relative overflow-hidden ring-1 transition-colors",
            slide
              ? "bg-black ring-stroke group-hover:ring-stroke-emphasis"
              : "bg-surface-secondary ring-stroke",
          )}
          style={{ width, height }}
        >
          {slide ? (
            <LayoutRenderer
              doc={resolvedSlideDoc(slide)}
              data={EMPTY_DATA}
              scope={`speaker-view-${direction}`}
            />
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
          {slide && (
            <span className="shrink-0 tabular-nums text-tertiary">
              {slide.globalSlideIndex + 1}
            </span>
          )}
        </div>
      </button>
    </div>
  );
};
