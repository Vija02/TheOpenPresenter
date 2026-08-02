import { CSSProperties } from "react";

import { StageMetrics, toPx } from "../geometry/scale";
import { Effect, Paint, Shadow, Stroke } from "../schema/paint";
import { Rect } from "../schema/rect";
import { TextStyle } from "../schema/style";

/** Geometry goes straight to CSS percentages */
export const rectToCss = (rect: Rect): CSSProperties => ({
  position: "absolute",
  left: `${rect.x}%`,
  top: `${rect.y}%`,
  width: `${rect.w}%`,
  height: `${rect.h}%`,
});

/** `rect` places the element itself. `fill` makes it fill a wrapper */
export type ElementPlacement = "rect" | "fill";

export const placementToCss = (
  placement: ElementPlacement,
  rect: Rect,
): CSSProperties =>
  placement === "fill" ? { position: "absolute", inset: 0 } : rectToCss(rect);

export const paintToCss = (paint: Paint): string => {
  switch (paint.type) {
    case "solid":
      return paint.opacity >= 1
        ? paint.color
        : `color-mix(in srgb, ${paint.color} ${paint.opacity * 100}%, transparent)`;
    case "linearGradient": {
      const stops = paint.stops
        .map((s) => `${s.color} ${s.offset * 100}%`)
        .join(", ");
      return `linear-gradient(${paint.angle}deg, ${stops})`;
    }
  }
};

const shadowToCss = (shadow: Shadow, m: StageMetrics): string =>
  [
    shadow.inner ? "inset" : "",
    `${toPx(shadow.x, m)}px`,
    `${toPx(shadow.y, m)}px`,
    `${toPx(shadow.blur, m)}px`,
    `${toPx(shadow.spread, m)}px`,
    shadow.color,
  ]
    .filter(Boolean)
    .join(" ");

/**
 * Strokes render as box-shadow rings rather than CSS borders. A border would
 * change the box size under content-box sizing, and elements are positioned
 * with exact width/height, so the geometry has to stay untouched.
 */
const strokeToShadow = (stroke: Stroke, m: StageMetrics): string[] => {
  const width = toPx(stroke.width, m);
  if (width <= 0) return [];
  const color = paintToCss(stroke.paint);

  switch (stroke.align) {
    case "inside":
      return [`inset 0 0 0 ${width}px ${color}`];
    case "outside":
      return [`0 0 0 ${width}px ${color}`];
    case "center":
      return [
        `inset 0 0 0 ${width / 2}px ${color}`,
        `0 0 0 ${width / 2}px ${color}`,
      ];
  }
};

export const appearanceToCss = (
  {
    fill,
    stroke,
    effects,
    radius,
    clip,
    opacity,
    rotation,
  }: {
    fill: Paint | null;
    stroke: Stroke | null;
    effects: Effect[];
    radius: number;
    clip: boolean;
    opacity: number;
    rotation: number;
  },
  m: StageMetrics,
): CSSProperties => {
  const shadows = effects
    .filter(
      (e): e is Extract<Effect, { type: "shadow" }> => e.type === "shadow",
    )
    .map((e) => shadowToCss(e, m));

  const blurs = effects
    .filter((e): e is Extract<Effect, { type: "blur" }> => e.type === "blur")
    .map((e) => `blur(${toPx(e.radius, m)}px)`);

  const rings = stroke ? strokeToShadow(stroke, m) : [];
  const boxShadow = [...rings, ...shadows].join(", ");

  return {
    background: fill ? paintToCss(fill) : undefined,
    borderRadius: radius > 0 ? `${toPx(radius, m)}px` : undefined,
    overflow: clip ? "hidden" : undefined,
    opacity: opacity < 1 ? opacity : undefined,
    transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
    boxShadow: boxShadow || undefined,
    filter: blurs.length > 0 ? blurs.join(" ") : undefined,
  };
};

/** `spread` and `inner` have no CSS text-shadow equivalent and are dropped. */
export const textShadowToCss = (
  shadows: Shadow[],
  m: StageMetrics,
): string | undefined => {
  if (shadows.length === 0) return undefined;
  return shadows
    .map(
      (s) =>
        `${toPx(s.x, m)}px ${toPx(s.y, m)}px ${toPx(s.blur, m)}px ${s.color}`,
    )
    .join(", ");
};

const alignToFlex = (
  valign: TextStyle["valign"],
): CSSProperties["justifyContent"] =>
  valign === "top" ? "flex-start" : valign === "bottom" ? "flex-end" : "center";

/** Text properties that do not depend on the fitted size. */
export const textStyleToCss = (
  style: TextStyle,
  m: StageMetrics,
): CSSProperties => ({
  fontFamily: style.fontFamily,
  fontWeight: style.fontWeight,
  fontStyle: style.fontStyle,
  color: style.color,
  textAlign: style.align,
  lineHeight: style.lineHeight,
  letterSpacing:
    style.letterSpacing !== 0 ? `${toPx(style.letterSpacing, m)}px` : undefined,
  textShadow: textShadowToCss(style.shadows, m),
  WebkitTextStroke: style.outline
    ? `${toPx(style.outline.width, m)}px ${paintToCss(style.outline.paint)}`
    : undefined,
  paintOrder: style.outline ? "stroke fill" : undefined,
  justifyContent: alignToFlex(style.valign),
});
