import type { OfficeMorphFrame, OfficeMorphPair } from "./types";

/**
 * The Morph transition, following PowerPoint for the web's `MorphRenderer`:
 * every matched object moves, resizes and turns from its box on the previous
 * slide to its box on the new one, its old look fading into its new one.
 * Objects on only one side fade out or in where they are.
 */

export type MorphBox = Pick<
  OfficeMorphFrame,
  "cx" | "cy" | "w" | "h" | "rotateDeg"
>;

export type MorphLayer = {
  side: "from" | "to";
  frame: OfficeMorphFrame;
  /** Where the frame's box is drawn at this moment */
  box: MorphBox;
  opacity: number;
};

/** The viewer's easing: quick out of the start, settling into the end */
export const morphEase = (t: number) =>
  0.5 - 0.5 * Math.cos(2 * Math.PI * (1 - 1 / (t + 1)));

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Turns the short way round, as the viewer does */
const lerpAngle = (a: number, b: number, k: number) => {
  const norm = (d: number) => ((d % 360) + 360) % 360;
  let from = norm(a);
  let to = norm(b);
  if (to - from > 180) from += 360;
  else if (from - to > 180) to += 360;
  return lerp(from, to, k);
};

export const interpolateBox = (
  from: MorphBox,
  to: MorphBox,
  k: number,
): MorphBox => ({
  cx: lerp(from.cx, to.cx, k),
  cy: lerp(from.cy, to.cy, k),
  w: lerp(from.w, to.w, k),
  h: lerp(from.h, to.h, k),
  rotateDeg: lerpAngle(from.rotateDeg, to.rotateDeg, k),
});

/** Every object's layers at `t` (0..1), bottom to top. Backgrounds excluded */
export const morphLayers = (
  pairs: OfficeMorphPair[],
  t: number,
): MorphLayer[] => {
  const p = Math.max(0, Math.min(1, t));
  const k = morphEase(p);
  const layers: { z: number; layer: MorphLayer }[] = [];

  for (const pair of pairs) {
    if (pair.background) continue;
    const { from, to } = pair;
    const z = to?.z ?? from?.z ?? 0;
    if (from && to) {
      const box = interpolateBox(from, to, k);
      // The new look fades in over the old one, which stays solid until
      // halfway: where they overlap that is exactly a crossfade, without the
      // background showing through mid-way
      layers.push({
        z,
        layer: {
          side: "from",
          frame: from,
          box,
          opacity: Math.min(1, 2 - 2 * p),
        },
      });
      layers.push({ z, layer: { side: "to", frame: to, box, opacity: p } });
    } else if (from) {
      layers.push({
        z,
        layer: { side: "from", frame: from, box: from, opacity: 1 - p },
      });
    } else if (to) {
      layers.push({ z, layer: { side: "to", frame: to, box: to, opacity: p } });
    }
  }

  return layers.sort((a, b) => a.z - b.z).map((x) => x.layer);
};

/**
 * CSS transform (origin at the slide's top-left) that carries content laid out
 * around `source` onto `target`.
 */
export const morphTransform = (source: MorphBox, target: MorphBox) => {
  const sx = source.w ? target.w / source.w : 1;
  const sy = source.h ? target.h / source.h : 1;
  return [
    `translate(${target.cx}px, ${target.cy}px)`,
    `rotate(${target.rotateDeg}deg)`,
    `scale(${sx}, ${sy})`,
    `rotate(${-source.rotateDeg}deg)`,
    `translate(${-source.cx}px, ${-source.cy}px)`,
  ].join(" ");
};
