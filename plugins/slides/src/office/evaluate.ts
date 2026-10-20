import {
  ADDITIVE_ATTRS,
  type Attr,
  type ClipKind,
  type EffectContext,
  entranceExitTracks,
  sampleTrack,
  smoothProgress,
} from "./effects";
import type { ScheduledAnim, SlideTimeline, TargetKey } from "./timeline";
import type {
  OfficeAnimation,
  OfficePathCommand,
  OfficeShape,
  OfficeSlide,
  OfficeSprite,
} from "./types";

/**
 * What one shape (or built piece) looks like at a moment in the slide. Pure:
 * the same slide, group and elapsed time always give the same frame, which is
 * what lets every screen and the presenter preview agree.
 */
export type TargetState = {
  visible: boolean;
  /** Offsets, in slide pixels */
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  /** Radians */
  rotate: number;
  alpha: number;
  /** Changes to the sprite rectangle's edges, in slide pixels */
  cropL: number;
  cropT: number;
  cropR: number;
  cropB: number;
  clip: { kind: ClipKind; progress: number } | null;
  overlay: { sprite: OfficeSprite; alpha: number } | null;
};

export type SlideFrame = Map<TargetKey, TargetState>;

/** Treat as "long finished" */
export const SETTLED = Number.POSITIVE_INFINITY;

const restState = (visible: boolean): TargetState => ({
  visible,
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotate: 0,
  alpha: 1,
  cropL: 0,
  cropT: 0,
  cropR: 0,
  cropB: 0,
  clip: null,
  overlay: null,
});

const applyAttr = (state: TargetState, attr: Attr, value: number) => {
  if (attr === "clip") return;
  if (ADDITIVE_ATTRS.has(attr)) {
    state[attr as "x"] += value;
  } else {
    state[attr as "alpha"] *= value;
  }
};

/** The sprite an animation target draws. Null for a shape with only pieces */
export const targetSprite = (
  shape: OfficeShape,
  child: number | null,
): OfficeSprite | null => {
  if (child !== null) return shape.children[child] ?? null;
  return shape.region ? { x: shape.x, y: shape.y, region: shape.region } : null;
};

const parseTarget = (key: TargetKey) => {
  const [id, child] = key.split(":");
  return {
    shapeId: Number(id),
    child: child === undefined ? null : Number(child),
  };
};

/** Where one play is up to: index of the play and its 0..1 progress */
const playPosition = (item: ScheduledAnim, t: number) => {
  const total = item.plays * item.playMs;
  if (t >= total) return null;
  const index = Math.floor(t / item.playMs);
  return { index, fraction: (t - index * item.playMs) / item.playMs };
};

// ---------------------------------------------------------------- entrance/exit

const applyEntranceExit = (
  state: TargetState,
  item: ScheduledAnim,
  t: number,
  ended: boolean,
  ctx: EffectContext,
) => {
  const { anim } = item;
  const entrance = anim.kind === "entrance";
  const effect = entranceExitTracks(anim.effectId, ctx);
  const position = ended ? null : playPosition(item, t);

  if (!position) {
    // Settled. Flash effects and exits leave the shape hidden; a rewind
    // puts it back the way it was.
    const shown = effect.flash ? false : entrance;
    state.visible = anim.rewind ? !shown : shown;
    return;
  }

  state.visible = true;
  const p = smoothProgress(position.fraction, anim.smoothStart, anim.smoothEnd);
  // Exits run the entrance backwards, except effects that move one way
  const k = entrance || effect.flash === "credits" ? p : 1 - p;
  for (const track of effect.tracks) {
    const value = sampleTrack(track, k);
    if (track.attr === "clip" && track.clip) {
      state.clip = { kind: track.clip, progress: value };
    } else {
      applyAttr(state, track.attr, value);
    }
  }
};

// ---------------------------------------------------------------- emphasis

// Emphasis preset ids (ST_EmphasisEffect)
const EMPH = {
  changeFillColor: 1,
  changeFont: 2,
  changeFontColor: 3,
  changeFontSize: 4,
  changeFontStyle: 5,
  growShrink: 6,
  changeLineColor: 7,
  spin: 8,
  transparency: 9,
  boldFlash: 10,
  blast: 14,
  boldReveal: 15,
  brushOnColor: 16,
  brushOnUnderline: 18,
  colorBlend: 19,
  colorWave: 20,
  complementaryColor: 21,
  complementaryColor2: 22,
  contrastingColor: 23,
  darken: 24,
  desaturate: 25,
  flashBulb: 26,
  flicker: 27,
  growWithColor: 28,
  lighten: 30,
  styleEmphasis: 31,
  teeter: 32,
  verticalHighlight: 33,
  wave: 34,
  blink: 35,
  shimmer: 36,
} as const;

const COLOR_OVERLAY = new Set<number>([
  EMPH.changeFillColor,
  EMPH.changeFontColor,
  EMPH.changeLineColor,
  EMPH.colorBlend,
  EMPH.complementaryColor,
  EMPH.complementaryColor2,
  EMPH.contrastingColor,
  EMPH.darken,
  EMPH.desaturate,
  EMPH.lighten,
]);
const INSTANT_OVERLAY = new Set<number>([
  EMPH.changeFont,
  EMPH.changeFontStyle,
  EMPH.boldFlash,
  EMPH.styleEmphasis,
]);

/** The viewer swaps several emphasis presets for ones it can draw */
const emphasisEffect = (anim: OfficeAnimation) => {
  switch (anim.effectId) {
    case EMPH.boldReveal:
      return { id: EMPH.growShrink, scaleX: 110, scaleY: 110 };
    case EMPH.changeFontSize:
      return { id: EMPH.growShrink, scaleX: anim.scaleX, scaleY: anim.scaleY };
    case EMPH.blast:
      return { id: EMPH.verticalHighlight };
    case EMPH.growWithColor:
    case EMPH.brushOnUnderline:
    case EMPH.brushOnColor:
    case EMPH.colorWave:
      return { id: EMPH.shimmer };
    default:
      return { id: anim.effectId, scaleX: anim.scaleX, scaleY: anim.scaleY };
  }
};

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** 0..1..0 over [0, 1] in `n` evenly spaced keyframe values */
const keyframes = (values: number[], k: number) => {
  const spans = values.length - 1;
  const at = Math.min(spans, Math.max(0, k * spans));
  const i = Math.min(spans - 1, Math.floor(at));
  return lerp(values[i]!, values[i + 1]!, at - i);
};

const applyEmphasis = (
  state: TargetState,
  item: ScheduledAnim,
  t: number,
  ended: boolean,
  groupAdvanced: boolean,
) => {
  const { anim } = item;
  const effect = emphasisEffect(anim);
  const untilClick =
    anim.duration.type === "untilClick" || anim.repeat === "untilClick";
  const untilSlide =
    anim.duration.type === "untilSlide" || anim.repeat === "untilSlide";
  // "Until next click" effects let go once the next click comes
  const released = untilClick && groupAdvanced;

  // Grow/Shrink and Spin animate to a value and then hold it
  if (effect.id === EMPH.growShrink || effect.id === EMPH.spin) {
    const playMs =
      effect.id === EMPH.growShrink && (untilClick || untilSlide)
        ? 200
        : item.playMs;
    const cycle = anim.autoReverse ? 2 : 1;
    const plays =
      typeof anim.repeat === "number" ? (anim.repeat + 1) * cycle : Infinity;
    let k: number;
    if (ended || t >= plays * playMs) {
      k = anim.autoReverse || anim.rewind || released ? 0 : 1;
    } else {
      const play = Math.floor(t / playMs);
      const fraction = (t - play * playMs) / playMs;
      const p = smoothProgress(fraction, anim.smoothStart, anim.smoothEnd);
      k = anim.autoReverse && play % 2 === 1 ? 1 - p : p;
    }
    if (effect.id === EMPH.spin) {
      state.rotate += (anim.rotateDeg * Math.PI * k) / 180;
    } else {
      state.scaleX *= lerp(1, (effect.scaleX ?? 100) / 100, k);
      state.scaleY *= lerp(1, (effect.scaleY ?? 100) / 100, k);
    }
    return;
  }

  if (effect.id === EMPH.transparency) {
    const active = untilSlide
      ? true
      : untilClick
        ? !groupAdvanced
        : !ended && t < item.playMs;
    if (active) state.alpha *= (100 - anim.transparency) / 100;
    return;
  }

  if (COLOR_OVERLAY.has(effect.id) || INSTANT_OVERLAY.has(effect.id)) {
    if (!anim.emphasisSprite) return;
    let alpha: number;
    if (INSTANT_OVERLAY.has(effect.id)) {
      alpha = 1;
    } else if (ended || t >= item.plays * item.playMs) {
      alpha = anim.autoReverse || anim.rewind ? 0 : 1;
    } else {
      const play = Math.floor(t / item.playMs);
      const p = (t - play * item.playMs) / item.playMs;
      alpha = anim.autoReverse && play % 2 === 1 ? 1 - p : p;
    }
    if (released) alpha = 0;
    if (alpha > 0) state.overlay = { sprite: anim.emphasisSprite, alpha };
    return;
  }

  // The rest only move while they play
  const position = ended ? null : playPosition(item, t);
  if (!position) return;
  const k = position.fraction;
  switch (effect.id) {
    case EMPH.flashBulb: {
      const s = keyframes([1, 1.1, 1], k);
      state.scaleX *= s;
      state.scaleY *= s;
      state.alpha *= 0.2;
      return;
    }
    case EMPH.blink:
      if (k < 0.5) state.alpha = 0;
      return;
    case EMPH.shimmer:
      state.rotate += keyframes([0, Math.PI / 8, 0], k);
      return;
    case EMPH.wave:
      state.rotate += keyframes([0, -Math.PI / 8, Math.PI / 8, 0], k);
      state.y += keyframes([0, -100, 0], k);
      return;
    case EMPH.teeter: {
      const th = -Math.PI / 16;
      state.rotate += keyframes([0, th, -th, th, -th, 0], k);
      return;
    }
    case EMPH.verticalHighlight:
      state.scaleY *= keyframes([1, 1.5, 1.5, 1.5, 1], k);
      return;
    case EMPH.flicker:
      if (anim.emphasisSprite) {
        state.overlay = {
          sprite: anim.emphasisSprite,
          alpha: keyframes([0, 1, 0], k),
        };
      }
      return;
    default:
      return;
  }
};

// ---------------------------------------------------------------- motion path

type Point = { x: number; y: number };

const bezier = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const u = 1 - t;
  return (
    u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
  );
};

/** Points along the path, with cumulative length, for constant-speed travel */
const flattenPath = (commands: OfficePathCommand[], scale: Point) => {
  const points: { p: Point; len: number }[] = [];
  let current: Point = { x: 0, y: 0 };
  let length = 0;
  const push = (p: Point) => {
    if (points.length) {
      length += Math.hypot(p.x - current.x, p.y - current.y);
    }
    points.push({ p, len: length });
    current = p;
  };
  for (const cmd of commands) {
    const end = { x: cmd.x * scale.x, y: cmd.y * scale.y };
    if (cmd.type === "M") {
      if (points.length === 0) push(end);
      else current = end;
    } else if (cmd.type === "L") {
      if (points.length === 0) push(current);
      push(end);
    } else {
      if (points.length === 0) push(current);
      const start = current;
      for (let i = 1; i <= 16; i++) {
        const t = i / 16;
        push({
          x: bezier(start.x, cmd.x1 * scale.x, cmd.x2 * scale.x, end.x, t),
          y: bezier(start.y, cmd.y1 * scale.y, cmd.y2 * scale.y, end.y, t),
        });
      }
    }
  }
  return { points, length };
};

const pointAlong = (path: ReturnType<typeof flattenPath>, k: number): Point => {
  const { points, length } = path;
  if (!points.length) return { x: 0, y: 0 };
  const target = length * Math.min(1, Math.max(0, k));
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (b.len >= target) {
      const span = b.len - a.len;
      const f = span > 0 ? (target - a.len) / span : 1;
      return { x: lerp(a.p.x, b.p.x, f), y: lerp(a.p.y, b.p.y, f) };
    }
  }
  return points[points.length - 1]!.p;
};

/**
 * Path coordinates come either in slide pixels or, as PowerPoint stores them,
 * as fractions of the slide. Tell them apart by size.
 */
const pathScale = (commands: OfficePathCommand[], ctx: EffectContext) => {
  const extent = commands.reduce(
    (max, c) =>
      Math.max(
        max,
        Math.abs(c.x),
        Math.abs(c.y),
        ...(c.type === "C"
          ? [Math.abs(c.x1), Math.abs(c.y1), Math.abs(c.x2), Math.abs(c.y2)]
          : []),
      ),
    0,
  );
  return extent <= 2 ? { x: ctx.slideW, y: ctx.slideH } : { x: 1, y: 1 };
};

const applyPath = (
  state: TargetState,
  item: ScheduledAnim,
  t: number,
  ended: boolean,
  ctx: EffectContext,
) => {
  const { anim } = item;
  if (!anim.path) return;
  const commands = anim.path.commands;
  const path = flattenPath(commands, pathScale(commands, ctx));
  let k: number;
  const position = ended ? null : playPosition(item, t);
  if (!position) {
    k = anim.rewind || anim.autoReverse ? 0 : 1;
  } else {
    const p = smoothProgress(
      position.fraction,
      anim.smoothStart,
      anim.smoothEnd,
    );
    k = anim.autoReverse && position.index % 2 === 1 ? 1 - p : p;
  }
  if (anim.path.reversed) k = 1 - k;
  const at = pointAlong(path, k);
  state.x += at.x;
  state.y += at.y;
};

// ---------------------------------------------------------------- frame

/**
 * The state of every animated target, `elapsedMs` after `group`'s click.
 * Groups before `group` are settled. Targets missing from the map are never
 * animated and simply show.
 */
export const evaluateSlide = (
  slide: OfficeSlide,
  timeline: SlideTimeline,
  group: number,
  elapsedMs: number,
  slideSize: { width: number; height: number },
): SlideFrame => {
  const shapes = new Map(slide.shapes.map((shape) => [shape.id, shape]));
  const frame: SlideFrame = new Map();

  for (const item of timeline.items) {
    if (!frame.has(item.target)) {
      frame.set(
        item.target,
        restState(!timeline.initiallyHidden.has(item.target)),
      );
    }
  }

  for (const item of timeline.items) {
    if (item.group > group) continue;
    const ended = item.group < group;
    const t = ended ? SETTLED : elapsedMs - item.startMs;
    if (t < 0) continue;

    const state = frame.get(item.target)!;
    const { shapeId, child } = parseTarget(item.target);
    const shape = shapes.get(shapeId);
    if (!shape) continue;
    const sprite = targetSprite(shape, child);
    if (!sprite) continue;
    const ctx: EffectContext = {
      x: sprite.x,
      y: sprite.y,
      w: sprite.region.w,
      h: sprite.region.h,
      slideW: slideSize.width,
      slideH: slideSize.height,
      direction: item.anim.direction,
      entrance: item.anim.kind === "entrance",
    };

    switch (item.anim.kind) {
      case "entrance":
      case "exit":
        applyEntranceExit(state, item, t, ended, ctx);
        break;
      case "emphasis":
        applyEmphasis(state, item, t, ended, ended);
        break;
      case "path":
        applyPath(state, item, t, ended, ctx);
        break;
      default:
        break;
    }

    const done = ended || t >= item.plays * item.playMs;
    if (done && item.anim.hideAfter === "immediately") state.visible = false;
    if (ended && item.anim.hideAfter === "nextClick") state.visible = false;
  }

  return frame;
};

/** Last moment anything on the slide moves in this group, or 0 */
export const groupEndMs = (timeline: SlideTimeline, group: number) =>
  group <= 0 ? 0 : (timeline.groupDurationsMs[group - 1] ?? 0);
