import type { OfficeTransition } from "./types";

/**
 * Slide transitions. `OfficeTransition.type` is PowerPoint's binary
 * TransitionType ([MS-PPT]), extended with 43 Flip, 44 Cube and 60 Morph. The
 * viewer maps them in `TransitionEffect.setup`; anything it can't draw becomes
 * a 700ms fade, and so do we, except Morph, which we draw from the matched
 * objects the service sends (`OfficeTransition.morph`).
 */

export type TransitionKind =
  | "cut"
  | "fade"
  | "fadeThroughBlack"
  | "push"
  | "cover"
  | "uncover"
  | "wipe"
  | "strips"
  | "split"
  | "box"
  | "diamond"
  | "plus"
  | "circle"
  | "wedge"
  | "wheel"
  | "blinds"
  | "checkerboard"
  | "randomBars"
  | "comb"
  | "newsflash"
  | "flip"
  | "cube"
  | "morph";

const KIND_BY_TYPE: Record<number, TransitionKind> = {
  0: "cut",
  2: "blinds",
  3: "checkerboard",
  4: "cover",
  5: "fade",
  6: "fadeThroughBlack",
  7: "uncover",
  8: "randomBars",
  9: "strips",
  10: "wipe",
  11: "box",
  13: "split",
  17: "diamond",
  18: "plus",
  19: "wedge",
  20: "push",
  21: "comb",
  22: "newsflash",
  23: "fade",
  26: "wheel",
  27: "circle",
  43: "flip",
  44: "cube",
  60: "morph",
};

/** What the viewer plays for transitions it can't draw */
const FALLBACK_FADE_MS = 700;

/** Direction (`dir`) values */
export const TRANSITION_DIR = {
  left: 0,
  top: 1,
  right: 2,
  bottom: 3,
  topLeft: 4,
  topRight: 5,
  bottomLeft: 6,
  bottomRight: 7,
  // Split
  horizontalOut: 0,
  horizontalIn: 1,
  verticalOut: 2,
  verticalIn: 3,
  // Box, shapes
  out: 0,
  in: 1,
} as const;

export type TransitionPlayback = {
  kind: TransitionKind;
  durationMs: number;
  direction: number;
};

export const transitionPlayback = (
  transition: OfficeTransition | null,
): TransitionPlayback => {
  if (!transition) return { kind: "cut", durationMs: 0, direction: 0 };
  const kind = KIND_BY_TYPE[transition.type];
  // Morph is only drawable with the matched objects; imports from before we
  // kept them get the viewer's fallback
  if (!kind || (kind === "morph" && !transition.morph?.length)) {
    return { kind: "fade", durationMs: FALLBACK_FADE_MS, direction: 0 };
  }
  if (kind === "cut") return { kind, durationMs: 0, direction: 0 };
  return {
    kind,
    durationMs:
      transition.durationMs > 0 ? transition.durationMs : FALLBACK_FADE_MS,
    direction: transition.direction,
  };
};
