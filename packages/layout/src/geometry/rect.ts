import { Rect } from "../schema/rect";

/** Smallest allowed element edge, in percent. */
export const MIN_RECT_SIZE = 2;

/** One decimal place, so a no-op drag frame diffs to nothing in Yjs. */
export const roundRect = (rect: Rect, precision = 1): Rect => {
  const f = 10 ** precision;
  return {
    x: Math.round(rect.x * f) / f,
    y: Math.round(rect.y * f) / f,
    w: Math.round(rect.w * f) / f,
    h: Math.round(rect.h * f) / f,
  };
};

export const clampRect = (rect: Rect): Rect => {
  const w = Math.max(MIN_RECT_SIZE, rect.w);
  const h = Math.max(MIN_RECT_SIZE, rect.h);
  return {
    x: Math.min(Math.max(0, rect.x), Math.max(0, 100 - w)),
    y: Math.min(Math.max(0, rect.y), Math.max(0, 100 - h)),
    w,
    h,
  };
};

export const rectsEqual = (a: Rect, b: Rect): boolean =>
  a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

export const normalizeRotation = (degrees: number, precision = 1): number => {
  const f = 10 ** precision;
  const wrapped = ((degrees % 360) + 360) % 360;
  // A value a hair under 360 must not round up to 360, which is not in range.
  return (Math.round(wrapped * f) / f) % 360;
};
