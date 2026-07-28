import { AspectRatio, LayoutFitMode } from "../schema/document";
import { Rect } from "../schema/rect";

/** The only place the normalized model meets pixels. */
export type StageMetrics = {
  containerWidth: number;
  containerHeight: number;
  /** The design box. Equal to the container unless letterboxing. */
  boxWidth: number;
  boxHeight: number;
  /** Offset of the design box inside the container. Zero unless letterboxing. */
  offsetX: number;
  offsetY: number;
  /** Px per design unit, where 1 unit is 1% of box width. */
  unit: number;
};

export type ComputeStageOptions = {
  containerWidth: number;
  containerHeight: number;
  aspectRatio: AspectRatio;
  fitMode: LayoutFitMode;
};

export const computeStageMetrics = ({
  containerWidth,
  containerHeight,
  aspectRatio,
  fitMode,
}: ComputeStageOptions): StageMetrics => {
  const safeWidth = Math.max(0, containerWidth);
  const safeHeight = Math.max(0, containerHeight);

  if (fitMode === "fluid") {
    return {
      containerWidth: safeWidth,
      containerHeight: safeHeight,
      boxWidth: safeWidth,
      boxHeight: safeHeight,
      offsetX: 0,
      offsetY: 0,
      unit: safeWidth / 100,
    };
  }

  const target = aspectRatio.width / aspectRatio.height;
  const containerAspect = safeHeight === 0 ? target : safeWidth / safeHeight;

  // Whichever axis is the binding constraint shrinks the box to the target.
  const heightBound = containerAspect > target;
  const boxWidth = heightBound ? safeHeight * target : safeWidth;
  const boxHeight = heightBound ? safeHeight : safeWidth / target;

  return {
    containerWidth: safeWidth,
    containerHeight: safeHeight,
    boxWidth,
    boxHeight,
    offsetX: (safeWidth - boxWidth) / 2,
    offsetY: (safeHeight - boxHeight) / 2,
    unit: boxWidth / 100,
  };
};

/** Design unit scalar (font size, stroke width, radius) to px. */
export const toPx = (units: number, metrics: StageMetrics): number =>
  units * metrics.unit;

export type PixelBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export const rectToPx = (rect: Rect, metrics: StageMetrics): PixelBox => ({
  left: metrics.offsetX + (rect.x / 100) * metrics.boxWidth,
  top: metrics.offsetY + (rect.y / 100) * metrics.boxHeight,
  width: (rect.w / 100) * metrics.boxWidth,
  height: (rect.h / 100) * metrics.boxHeight,
});

export const pxToRect = (box: PixelBox, metrics: StageMetrics): Rect => ({
  x:
    metrics.boxWidth === 0
      ? 0
      : ((box.left - metrics.offsetX) / metrics.boxWidth) * 100,
  y:
    metrics.boxHeight === 0
      ? 0
      : ((box.top - metrics.offsetY) / metrics.boxHeight) * 100,
  w: metrics.boxWidth === 0 ? 0 : (box.width / metrics.boxWidth) * 100,
  h: metrics.boxHeight === 0 ? 0 : (box.height / metrics.boxHeight) * 100,
});
