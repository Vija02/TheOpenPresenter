import type { CSSProperties } from "react";

import {
  TRANSITION_DIR,
  type TransitionKind,
} from "../../../src/office/transitions";
import { clipStyle } from "./clipStyles";

/**
 * One frame of a slide transition. `from` is the slide being left, drawn
 * below; `to` is the slide arriving, drawn on top unless `fromOnTop`.
 * `t` runs 0..1; playing a transition backwards is the same with `t` reversed.
 */
export type TransitionFrame = {
  from: CSSProperties;
  to: CSSProperties;
  fromOnTop?: boolean;
};

const D = TRANSITION_DIR;

/** Unit vector the content moves along. Diagonals for strips */
const MOVE: Record<number, [number, number]> = {
  [D.left]: [-1, 0],
  [D.top]: [0, -1],
  [D.right]: [1, 0],
  [D.bottom]: [0, 1],
  [D.topLeft]: [-1, -1],
  [D.topRight]: [1, -1],
  [D.bottomLeft]: [-1, 1],
  [D.bottomRight]: [1, 1],
};

const translate = ([x, y]: [number, number], amount: number) =>
  `translate(${x * amount * 100}%, ${y * amount * 100}%)`;

const maskImage = (image: string): CSSProperties => ({
  maskImage: image,
  WebkitMaskImage: image,
});

/** A soft edge sweeping across in the direction of movement */
const sweep = ([x, y]: [number, number], t: number) => {
  const side = [
    y < 0 ? "top" : y > 0 ? "bottom" : "",
    x < 0 ? "left" : x > 0 ? "right" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const edge = t * 120 - 10;
  return maskImage(
    `linear-gradient(to ${side}, black ${edge}%, transparent ${edge + 10}%)`,
  );
};

const fromClip = (kind: Parameters<typeof clipStyle>[0], t: number) => {
  const clip = clipStyle(kind, t);
  return { ...clip.style, opacity: clip.opacity };
};

export const transitionFrame = (
  kind: TransitionKind,
  direction: number,
  t: number,
): TransitionFrame => {
  const p = Math.max(0, Math.min(1, t));
  const move = MOVE[direction] ?? MOVE[D.left]!;
  const outward = direction === D.out;

  switch (kind) {
    case "cut":
      return { from: { opacity: 0 }, to: {} };
    case "fadeThroughBlack":
      return {
        from: { opacity: Math.max(0, 1 - 2 * p) },
        to: { opacity: Math.max(0, 2 * p - 1) },
      };
    case "push":
      return {
        from: { transform: translate(move, p) },
        to: { transform: translate(move, p - 1) },
      };
    case "cover":
      return { from: {}, to: { transform: translate(move, p - 1) } };
    case "uncover":
      return {
        from: { transform: translate(move, p) },
        to: {},
        fromOnTop: true,
      };
    case "wipe":
    case "strips":
      return { from: {}, to: sweep(move, p) };
    case "split": {
      const clip =
        direction === D.horizontalIn
          ? "splitHI"
          : direction === D.verticalOut
            ? "splitVO"
            : direction === D.verticalIn
              ? "splitVI"
              : "splitHO";
      return { from: {}, to: fromClip(clip, p) };
    }
    case "box":
      return { from: {}, to: fromClip(outward ? "boxOut" : "boxIn", p) };
    case "plus":
      return { from: {}, to: fromClip(outward ? "plusOut" : "plusIn", p) };
    case "diamond": {
      const r = (outward ? p : 1 - p) * 100;
      const diamond = `${50}% ${50 - r}%, ${50 + r}% 50%, 50% ${50 + r}%, ${50 - r}% 50%`;
      return {
        from: {},
        to: {
          clipPath:
            p >= 1
              ? "none"
              : outward
                ? `polygon(${diamond})`
                : `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${diamond})`,
        },
      };
    }
    case "circle": {
      const r = (outward ? p : 1 - p) * 75;
      return {
        from: {},
        to:
          p >= 1
            ? {}
            : outward
              ? { clipPath: `circle(${r}% at 50% 50%)` }
              : maskImage(
                  `radial-gradient(circle at 50% 50%, transparent ${r}%, black ${r}%)`,
                ),
      };
    }
    case "wedge": {
      const half = p * 180;
      return {
        from: {},
        to: maskImage(
          `conic-gradient(from 0deg at 50% 50%, black 0deg ${half}deg, transparent ${half}deg ${360 - half}deg, black ${360 - half}deg)`,
        ),
      };
    }
    case "wheel":
      return {
        from: {},
        to: maskImage(
          `conic-gradient(from 0deg at 50% 50%, black 0deg ${p * 360}deg, transparent ${p * 360}deg)`,
        ),
      };
    case "blinds":
    case "comb":
      return {
        from: {},
        to: fromClip(direction === 1 ? "blindsV" : "blindsH", p),
      };
    case "checkerboard":
      return {
        from: {},
        to: fromClip(direction === 1 ? "checkerboardD" : "checkerboardA", p),
      };
    case "randomBars":
      return {
        from: {},
        to: fromClip(direction === 1 ? "randomBarsV" : "randomBarsH", p),
      };
    case "newsflash":
      return {
        from: {},
        to: { transform: `rotate(${(1 - p) * 720}deg) scale(${p})` },
      };
    case "flip": {
      // The slide turns over like a card: the old face, then the new one
      const sign = direction === D.right ? -1 : 1;
      const turn = p * 180 * sign;
      return {
        from: {
          transform: `perspective(2400px) rotateY(${turn}deg)`,
          backfaceVisibility: "hidden",
        },
        to: {
          transform: `perspective(2400px) rotateY(${turn - 180 * sign}deg)`,
          backfaceVisibility: "hidden",
        },
      };
    }
    case "cube": {
      // Rotates like the faces of a box, turning towards the direction
      const sign = direction === D.right ? 1 : -1;
      return {
        from: {
          transform: `perspective(2400px) rotateY(${sign * p * 90}deg)`,
          transformOrigin: sign > 0 ? "100% 50%" : "0% 50%",
          backfaceVisibility: "hidden",
        },
        to: {
          transform: `perspective(2400px) rotateY(${sign * (p - 1) * 90}deg)`,
          transformOrigin: sign > 0 ? "0% 50%" : "100% 50%",
          backfaceVisibility: "hidden",
        },
      };
    }
    case "fade":
    default:
      return { from: {}, to: { opacity: p } };
  }
};
