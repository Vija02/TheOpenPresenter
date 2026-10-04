import {
  DEFAULT_ASPECT_RATIO,
  type StageMetrics,
  computeStageMetrics,
} from "@repo/layout";

import { isCustomImport } from "../customSlides";
import type { ResolvedSlide } from "../types";

export type InkTool = "laser" | "pencil" | "highlight";
export type InkStrokeTool = Exclude<InkTool, "laser">;

export type InkStroke = {
  id: string;
  tool: InkStrokeTool;
  color: string;
  /** Flat `[x, y, pressure, ...]`. x and y are fractions of the slide box */
  points: number[];
  /** Pressure came from a pen. Otherwise it is simulated from speed. */
  hasPressure: boolean;
};

export const INK_POINT_STRIDE = 3;

export const INK_COLORS: Record<InkTool, string> = {
  laser: "#ef4444",
  pencil: "#ef4444",
  highlight: "#fde047",
};

/** Stroke width as a fraction of the slide box width */
export const INK_SIZES: Record<InkTool, number> = {
  laser: 0.012,
  pencil: 0.005,
  highlight: 0.03,
};

/** Rounded to keep synced strokes small; 1/10000 of a slide is sub-pixel */
export const roundInk = (value: number) => Math.round(value * 10000) / 10000;

/**
 * Where the slide is drawn inside a renderer box of `width` x `height`, so
 * marks line up with its content. Layout slides follow their own fit mode
 * ("fluid" fills the box); images and the Google Slides embed are letterboxed.
 */
export const inkBox = (
  slide: ResolvedSlide,
  width: number,
  height: number,
): StageMetrics => {
  const doc = isCustomImport(slide.importData)
    ? slide.importData.docs[slide.localSlideIndex]
    : undefined;
  return computeStageMetrics({
    containerWidth: width,
    containerHeight: height,
    aspectRatio: doc?.aspectRatio ?? DEFAULT_ASPECT_RATIO,
    fitMode: doc?.fitMode ?? "letterbox",
  });
};
