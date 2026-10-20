import type { CSSProperties } from "react";

import type { ClipKind } from "../../../src/office/effects";

/**
 * CSS for PowerPoint's mask-style ("complex clip") effects at a reveal
 * progress of 0 (hidden) to 1 (fully shown). Random Bars, Checkerboard and
 * Dissolve are approximated with fine slats and a fade.
 */

const pct = (n: number) => `${Math.max(0, Math.min(100, n)).toFixed(3)}%`;

/** Everything but a centred rectangle, which shrinks as `p` grows */
const outerFrame = (insetX: number, insetY: number) =>
  `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${pct(insetX)} ${pct(insetY)}, ${pct(100 - insetX)} ${pct(insetY)}, ${pct(100 - insetX)} ${pct(100 - insetY)}, ${pct(insetX)} ${pct(100 - insetY)}, ${pct(insetX)} ${pct(insetY)})`;

/** Outline of a centred plus sign whose arms are `arm`% either side of centre */
const crossPoints = (arm: number) => {
  const a = pct(50 - arm);
  const b = pct(50 + arm);
  return `${a} 0%, ${b} 0%, ${b} ${a}, 100% ${a}, 100% ${b}, ${b} ${b}, ${b} 100%, ${a} 100%, ${a} ${b}, 0% ${b}, 0% ${a}, ${a} ${a}`;
};

const mask = (image: string, size: string): CSSProperties => ({
  maskImage: image,
  WebkitMaskImage: image,
  maskSize: size,
  WebkitMaskSize: size,
  maskRepeat: "repeat",
  WebkitMaskRepeat: "repeat",
});

/** Slats that each fill from one edge */
const slats = (count: number, horizontal: boolean, p: number) => {
  const edge = pct(p * 100);
  const image = `linear-gradient(${horizontal ? "to bottom" : "to right"}, black ${edge}, transparent ${edge})`;
  const size = horizontal
    ? `100% ${pct(100 / count)}`
    : `${pct(100 / count)} 100%`;
  return mask(image, size);
};

/** A soft diagonal edge sweeping from one corner */
const diagonal = (to: string, p: number) => {
  const edge = p * 120 - 10;
  const image = `linear-gradient(${to}, black ${pct(edge)}, transparent ${pct(edge + 10)})`;
  return {
    maskImage: image,
    WebkitMaskImage: image,
  } satisfies CSSProperties;
};

export const clipStyle = (
  kind: ClipKind,
  progress: number,
): { style: CSSProperties; opacity: number } => {
  const p = Math.max(0, Math.min(1, progress));
  const style = (s: CSSProperties) => ({ style: s, opacity: 1 });
  switch (kind) {
    case "boxOut":
      return style({ clipPath: `inset(${pct(50 * (1 - p))})` });
    case "boxIn":
      return style({ clipPath: outerFrame(50 * p, 50 * p) });
    case "splitVO":
      return style({ clipPath: `inset(0% ${pct(50 * (1 - p))})` });
    case "splitHO":
      return style({ clipPath: `inset(${pct(50 * (1 - p))} 0%)` });
    case "splitVI":
      return style({ clipPath: outerFrame(50 * p, -1) });
    case "splitHI":
      return style({ clipPath: outerFrame(-1, 50 * p) });
    case "plusOut":
      return style({
        clipPath: p >= 1 ? "none" : `polygon(${crossPoints(50 * p)})`,
      });
    case "plusIn":
      // Everything but a plus that shrinks away
      return style({
        clipPath:
          p >= 1
            ? "none"
            : `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${crossPoints(50 * (1 - p))})`,
      });
    case "blindsH":
      return style(slats(6, true, p));
    case "blindsV":
      return style(slats(6, false, p));
    case "checkerboardA":
      return style(slats(8, false, p));
    case "checkerboardD":
      return style(slats(8, true, p));
    case "randomBarsH":
      return style(slats(24, true, p));
    case "randomBarsV":
      return style(slats(24, false, p));
    case "stripsRD":
      return style(diagonal("to bottom right", p));
    case "stripsRU":
      return style(diagonal("to top right", p));
    case "stripsLD":
      return style(diagonal("to bottom left", p));
    case "stripsLU":
      return style(diagonal("to top left", p));
    case "dissolve":
    default:
      return { style: {}, opacity: p };
  }
};
