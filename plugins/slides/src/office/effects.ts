/**
 * Entrance/exit effects as keyframe tracks, transcribed from PowerPoint for
 * the web's own player (`addEffect_*` in its viewer bundle) so motion matches
 * what PowerPoint shows. Effects it has no implementation for fall back to
 * Fade, exactly as it does.
 *
 * A track is written in the entrance direction: each segment animates from
 * the effect's start offset (`from`) to rest (`to`). An exit plays the same
 * tracks backwards, unless the effect defines its own exit tracks.
 */

export type Attr =
  | "x"
  | "y"
  | "scaleX"
  | "scaleY"
  | "rotate"
  | "alpha"
  | "cropL"
  | "cropT"
  | "cropR"
  | "cropB"
  | "clip";

/** Additive attributes are offsets; the rest multiply */
export const ADDITIVE_ATTRS: ReadonlySet<Attr> = new Set([
  "x",
  "y",
  "rotate",
  "cropL",
  "cropT",
  "cropR",
  "cropB",
]);

export type ClipKind =
  | "blindsH"
  | "blindsV"
  | "boxIn"
  | "boxOut"
  | "checkerboardA"
  | "checkerboardD"
  | "dissolve"
  | "plusIn"
  | "plusOut"
  | "randomBarsH"
  | "randomBarsV"
  | "splitHI"
  | "splitHO"
  | "splitVI"
  | "splitVO"
  | "stripsLU"
  | "stripsLD"
  | "stripsRU"
  | "stripsRD";

/** Segment times are fractions of the effect's duration */
export type Segment = { t0: number; t1: number; from: number; to: number };

export type Track = { attr: Attr; segments: Segment[]; clip?: ClipKind };

export type EffectContext = {
  /** The animated object's resting box */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Slide size */
  slideW: number;
  slideH: number;
  direction: number;
  entrance: boolean;
};

export type EffectTracks = {
  tracks: Track[];
  /** Becomes visible at the start and hides again at the end, both ways */
  flash?: "once" | "credits";
};

// PowerPoint preset ids (ST_EntranceEffect in the viewer)
export const ENTRANCE = {
  appear: 1,
  fly: 2,
  blinds: 3,
  box: 4,
  checkerboard: 5,
  circle: 6,
  crawl: 7,
  diamond: 8,
  dissolve: 9,
  fade: 10,
  flashOnce: 11,
  peek: 12,
  plus: 13,
  randomBars: 14,
  spiral: 15,
  split: 16,
  stretch: 17,
  strips: 18,
  swivel: 19,
  wedge: 20,
  wheel: 21,
  wipe: 22,
  zoom: 23,
  random: 24,
  boomerang: 25,
  bounce: 26,
  colorReveal: 27,
  credits: 28,
  easeIn: 29,
  float: 30,
  growAndTurn: 31,
  lightspeed: 34,
  pinwheel: 35,
  riseUp: 37,
  swish: 38,
  thinLine: 39,
  unfold: 40,
  whip: 41,
  ascend: 42,
  centerRevolve: 43,
  fadedSwivel: 45,
  descend: 47,
  sling: 48,
  spinner: 49,
  compress: 50,
  zip: 51,
  arcUp: 52,
  fadedZoom: 53,
  glide: 54,
  expand: 55,
  flip: 56,
  fold: 58,
} as const;

// Direction flags (AnimDirConstants)
const DIR = {
  top: 1,
  right: 2,
  bottom: 4,
  left: 8,
  zoomIn: 16,
  zoomOut: 32,
  zoomSlightly: 256,
  zoomCenter: 512,
  stretchAcross: 10,
  swivelVertical: 5,
  blindsHoriz: 10,
  boxIn: 16,
  boxOut: 32,
  checkerboardAcross: 10,
  plusIn: 16,
  randomBarsHoriz: 10,
  splitHorizIn: 26,
  splitHorizOut: 42,
  splitVertIn: 21,
  splitVertOut: 37,
  stripsLeftUp: 9,
  stripsLeftDown: 12,
  stripsRightUp: 3,
  stripsRightDown: 6,
} as const;

// Tuning constants, in slide pixels / radians, from the viewer
const K = {
  zoomInSlightlyScale: 0.6666667,
  zoomOutScale: 3,
  zoomOutFromBottomScale: 5,
  zoomOutSlightlyScale: 1.25,
  boomerangX: 500,
  boomerangY1: -200,
  boomerangY2: 100,
  boomerangRot: -Math.PI / 2,
  floatX1: 350,
  floatX2: -40,
  floatY1: -250,
  floatY2: 60,
  floatRot: -Math.PI / 2,
  growAndTurnScale: 0.25,
  growAndTurnRot: Math.PI / 2,
  pinwheelRot: 3 * Math.PI,
  riseUpY1: 600,
  riseUpY2: -20,
  riseUpSplit: 0.9,
  swishDrop: 0.6,
  swishBounce: -40,
  swishTheta: -Math.PI / 6,
  thinLineX: -400,
  thinLineH: 0.05,
  thinLineW: 1.4,
  unfoldX: -200,
  whipMidScale: 1.1,
  whipX: 300,
  ascendY: 60,
  descendY: -60,
  slingRot: Math.PI / 2,
  slingMidX: -100,
  spinnerRot: Math.PI,
  spinnerScale: 0.25,
  expandWidth: 0.5,
  compressWidth: 1.75,
  zipYRatio: 0.85,
  zipMidScale: 2.5,
  glideX: -40,
  flipRot: 4 * Math.PI,
} as const;

const whole = (attr: Attr, from: number, to = attr === "alpha" ? 1 : 0) =>
  ({ attr, segments: [{ t0: 0, t1: 1, from, to }] }) satisfies Track;

const segs = (attr: Attr, segments: [number, number, number, number][]) =>
  ({
    attr,
    segments: segments.map(([t0, t1, from, to]) => ({ t0, t1, from, to })),
  }) satisfies Track;

const fade = (): Track => whole("alpha", 0, 1);
const scaleBoth = (from: number): Track[] => [
  whole("scaleX", from, 1),
  whole("scaleY", from, 1),
];

const fly = (ctx: EffectContext, direction: number): Track[] => {
  const tracks: Track[] = [];
  let dx = 0;
  let dy = 0;
  if (direction & DIR.left) dx = -(ctx.x + ctx.w);
  if (direction & DIR.top) dy = -(ctx.y + ctx.h);
  if (direction & DIR.right) dx = ctx.slideW - ctx.x;
  if (direction & DIR.bottom) dy = ctx.slideH - ctx.y;
  if (dx) tracks.push(whole("x", dx));
  if (dy) tracks.push(whole("y", dy));
  return tracks;
};

type ZoomMode =
  | "in"
  | "inFromCenter"
  | "inSlightly"
  | "out"
  | "outFromBottom"
  | "outSlightly";

const zoomMode = (direction: number, entrance: boolean): ZoomMode => {
  const zoomingIn = entrance
    ? direction & DIR.zoomIn
    : !(direction & DIR.zoomOut);
  if (zoomingIn) {
    if (direction & DIR.zoomCenter) return "inFromCenter";
    if (direction & DIR.zoomSlightly) return "inSlightly";
    return "in";
  }
  if (direction & DIR.bottom) return "outFromBottom";
  if (direction & DIR.zoomSlightly) return "outSlightly";
  return "out";
};

const zoom = (ctx: EffectContext, mode: ZoomMode): Track[] => {
  const tracks: Track[] = [];
  let scale = 0;
  if (mode === "inFromCenter") {
    tracks.push(whole("x", 0.5 * (ctx.slideW - ctx.w) - ctx.x));
    tracks.push(whole("y", 0.5 * (ctx.slideH - ctx.h) - ctx.y));
  } else if (mode === "inSlightly") {
    scale = K.zoomInSlightlyScale;
  } else if (mode === "out") {
    scale = K.zoomOutScale;
  } else if (mode === "outFromBottom") {
    scale = K.zoomOutFromBottomScale;
    tracks.push(whole("y", ctx.slideH - ctx.y));
  } else if (mode === "outSlightly") {
    scale = K.zoomOutSlightlyScale;
  }
  return [...tracks, ...scaleBoth(scale)];
};

const clip = (kind: ClipKind): Track => ({
  attr: "clip",
  clip: kind,
  segments: [{ t0: 0, t1: 1, from: 0, to: 1 }],
});

/** Which mask a "complex clip" effect uses. The in/out pair flips for exits */
const clipKind = (
  effectId: number,
  direction: number,
  entrance: boolean,
): ClipKind => {
  const pick = (a: ClipKind, b: ClipKind) => (entrance ? a : b);
  switch (effectId) {
    case ENTRANCE.blinds:
      return direction === DIR.blindsHoriz ? "blindsH" : "blindsV";
    case ENTRANCE.box:
      return direction === DIR.boxIn
        ? pick("boxIn", "boxOut")
        : pick("boxOut", "boxIn");
    case ENTRANCE.checkerboard:
      return direction === DIR.checkerboardAcross
        ? "checkerboardA"
        : "checkerboardD";
    case ENTRANCE.plus:
      return direction === DIR.plusIn
        ? pick("plusIn", "plusOut")
        : pick("plusOut", "plusIn");
    case ENTRANCE.randomBars:
      return direction === DIR.randomBarsHoriz ? "randomBarsH" : "randomBarsV";
    case ENTRANCE.split:
      switch (direction) {
        case DIR.splitHorizIn:
          return pick("splitHI", "splitHO");
        case DIR.splitHorizOut:
          return pick("splitHO", "splitHI");
        case DIR.splitVertIn:
          return pick("splitVI", "splitVO");
        default:
          return pick("splitVO", "splitVI");
      }
    case ENTRANCE.strips:
      switch (direction) {
        case DIR.stripsLeftUp:
          return "stripsLU";
        case DIR.stripsLeftDown:
          return "stripsLD";
        case DIR.stripsRightUp:
          return "stripsRU";
        default:
          return "stripsRD";
      }
    default:
      return "dissolve";
  }
};

const wipe = (ctx: EffectContext): Track[] => {
  let side = ctx.direction;
  if (!ctx.entrance) {
    side =
      side === DIR.bottom
        ? DIR.top
        : side === DIR.left
          ? DIR.right
          : side === DIR.right
            ? DIR.left
            : DIR.bottom;
  }
  switch (side) {
    case DIR.top:
      return [whole("cropB", -ctx.h)];
    case DIR.right:
      return [whole("cropL", ctx.w), whole("x", ctx.w)];
    case DIR.left:
      return [whole("cropR", -ctx.w)];
    default:
      return [whole("cropT", ctx.h), whole("y", ctx.h)];
  }
};

const peek = (ctx: EffectContext): Track[] => {
  switch (ctx.direction) {
    case DIR.top:
      return [whole("cropT", ctx.h)];
    case DIR.right:
      return [whole("cropR", -ctx.w), whole("x", ctx.w)];
    case DIR.left:
      return [whole("cropL", ctx.w)];
    default:
      return [whole("cropB", -ctx.h), whole("y", ctx.h)];
  }
};

const stretch = (ctx: EffectContext): Track[] => {
  switch (ctx.direction) {
    case DIR.left:
      return [whole("scaleX", 0, 1), whole("x", -ctx.w / 2)];
    case DIR.right:
      return [whole("scaleX", 0, 1), whole("x", ctx.w / 2)];
    case DIR.top:
      return [whole("scaleY", 0, 1), whole("y", -ctx.h / 2)];
    case DIR.bottom:
      return [whole("scaleY", 0, 1), whole("y", ctx.h / 2)];
    default:
      return [whole("scaleX", 0, 1)];
  }
};

const swivel = (ctx: EffectContext, faded: boolean): Track[] => [
  ctx.direction === DIR.swivelVertical
    ? whole("scaleY", 0, 1)
    : whole("scaleX", 0, 1),
  ...(faded ? [fade()] : []),
];

const expandCompress = (factor: number): Track[] => [
  fade(),
  whole("scaleX", factor, 1),
];

/** The tracks for one entrance or exit effect */
export const entranceExitTracks = (
  effectId: number,
  ctx: EffectContext,
): EffectTracks => {
  const E = ENTRANCE;
  switch (effectId) {
    case E.appear:
      return { tracks: [] };
    case E.fly:
    case E.crawl:
    case E.lightspeed:
      return { tracks: fly(ctx, ctx.direction) };
    case E.fade:
    case E.colorReveal:
    case E.random:
    case E.spiral:
      return { tracks: [fade()] };
    case E.blinds:
    case E.box:
    case E.checkerboard:
    case E.dissolve:
    case E.plus:
    case E.randomBars:
    case E.split:
    case E.strips:
      return {
        tracks: [clip(clipKind(effectId, ctx.direction, ctx.entrance))],
      };
    // The viewer swaps these for Box
    case E.circle:
    case E.diamond:
      return {
        tracks: [clip(clipKind(E.box, ctx.direction, ctx.entrance))],
      };
    case E.wheel:
    case E.wedge:
      return { tracks: [clip(clipKind(E.box, DIR.boxIn, ctx.entrance))] };
    case E.flashOnce:
      return { tracks: [], flash: "once" };
    case E.peek:
      return { tracks: peek(ctx) };
    case E.stretch:
      return { tracks: stretch(ctx) };
    case E.swivel:
      return { tracks: swivel(ctx, false) };
    case E.fadedSwivel:
      return { tracks: swivel(ctx, true) };
    case E.wipe:
      return { tracks: wipe(ctx) };
    case E.zoom:
      return { tracks: zoom(ctx, zoomMode(ctx.direction, ctx.entrance)) };
    case E.fadedZoom:
      return {
        tracks: [fade(), ...zoom(ctx, zoomMode(ctx.direction, ctx.entrance))],
      };
    case E.boomerang:
      return {
        tracks: [
          segs("x", [
            [0, 0.5, K.boomerangX, 0],
            [0.5, 1, 0, 0],
          ]),
          segs("y", [
            [0, 0.5, K.boomerangY1, K.boomerangY2],
            [0.5, 1, K.boomerangY2, 0],
          ]),
          segs("rotate", [[0, 0.5, K.boomerangRot, 0]]),
          segs("alpha", [[0, 0.5, 0, 1]]),
          whole("scaleX", 0, 1),
        ],
      };
    case E.float:
      return {
        tracks: [
          segs("x", [
            [0, 0.5, K.floatX1, K.floatX2],
            [0.5, 1, K.floatX2, 0],
          ]),
          segs("y", [
            [0, 0.5, K.floatY1, K.floatY2],
            [0.5, 1, K.floatY2, 0],
          ]),
          segs("rotate", [[0, 0.5, K.floatRot, 0]]),
          segs("alpha", [[0, 0.5, 0, 1]]),
        ],
      };
    case E.growAndTurn:
      return {
        tracks: [
          fade(),
          ...scaleBoth(K.growAndTurnScale),
          whole("rotate", K.growAndTurnRot),
        ],
      };
    case E.riseUp:
      return {
        tracks: [
          fade(),
          segs("y", [
            [0, K.riseUpSplit, K.riseUpY1, K.riseUpY2],
            [K.riseUpSplit, 1, K.riseUpY2, 0],
          ]),
        ],
      };
    case E.swish: {
      if (!ctx.entrance) {
        return {
          tracks: [whole("rotate", -K.swishTheta), whole("y", ctx.slideH)],
        };
      }
      const drop = K.swishDrop;
      const bounce = (1 - drop) / 2;
      return {
        tracks: [
          segs("y", [
            [0, drop, -ctx.slideH, 0],
            [drop, drop + bounce, 0, K.swishBounce],
            [drop + bounce, 1, K.swishBounce, 0],
          ]),
          segs("rotate", [
            [0, drop, K.swishTheta, K.swishTheta],
            [drop, drop + bounce, K.swishTheta, -K.swishTheta],
            [drop + bounce, 1, -K.swishTheta, 0],
          ]),
        ],
      };
    }
    case E.thinLine:
      return {
        tracks: [
          segs("x", [
            [0, 0.5, K.thinLineX, 0],
            [0.5, 1, 0, 0],
          ]),
          segs("scaleX", [
            [0, 0.5, K.thinLineW, K.thinLineW],
            [0.5, 1, K.thinLineW, 1],
          ]),
          segs("scaleY", [
            [0, 0.5, K.thinLineH, K.thinLineH],
            [0.5, 1, K.thinLineH, 1],
          ]),
        ],
      };
    case E.unfold:
      return { tracks: [fade(), whole("x", K.unfoldX)] };
    case E.whip:
      return {
        tracks: [
          segs("x", [
            [0, 0.5, K.whipX, K.whipX],
            [0.5, 1, K.whipX, 0],
          ]),
          segs("scaleX", [
            [0, 0.5, 0, K.whipMidScale],
            [0.5, 1, K.whipMidScale, 1],
          ]),
          segs("scaleY", [
            [0, 0.5, 0, K.whipMidScale],
            [0.5, 1, K.whipMidScale, 1],
          ]),
          segs("alpha", [
            [0, 0.5, 0, 1],
            [0.5, 1, 1, 1],
          ]),
        ],
      };
    case E.ascend:
      return { tracks: [fade(), whole("y", K.ascendY)] };
    case E.descend:
      return { tracks: [fade(), whole("y", K.descendY)] };
    case E.sling: {
      const start = -ctx.slideW - ctx.x;
      const mid = -ctx.x + ctx.slideW - K.slingMidX;
      return {
        tracks: [
          segs("x", [
            [0, 1 / 3, start, mid],
            [1 / 3, 2 / 3, mid, mid / 2],
            [2 / 3, 1, mid / 2, 0],
          ]),
          segs("rotate", [
            [0, 2 / 3, K.slingRot, K.slingRot],
            [2 / 3, 1, K.slingRot, 0],
          ]),
          fade(),
        ],
      };
    }
    case E.spinner:
      return {
        tracks: [
          fade(),
          ...scaleBoth(K.spinnerScale),
          whole("rotate", K.spinnerRot),
        ],
      };
    case E.pinwheel:
      return {
        tracks: [fade(), ...scaleBoth(0), whole("rotate", K.pinwheelRot)],
      };
    case E.compress:
      return { tracks: expandCompress(K.compressWidth) };
    case E.expand:
      return { tracks: expandCompress(K.expandWidth) };
    case E.zip: {
      const dx = 0.5 * (ctx.slideW - ctx.w) - ctx.x;
      const dy = (ctx.slideH - ctx.h) * K.zipYRatio - ctx.y;
      return {
        tracks: [
          segs("x", [
            [0, 0.5, dx, dx],
            [0.5, 1, dx, 0],
          ]),
          segs("y", [
            [0, 0.5, dy, dy],
            [0.5, 1, dy, 0],
          ]),
          segs("scaleX", [
            [0, 0.5, 1, K.zipMidScale],
            [0.5, 1, K.zipMidScale, 1],
          ]),
          segs("scaleY", [
            [0, 0.5, 1, K.zipMidScale],
            [0.5, 1, K.zipMidScale, 1],
          ]),
          segs("alpha", [[0, 0.5, 0, 1]]),
        ],
      };
    }
    case E.arcUp:
      return {
        tracks: [
          fade(),
          ...zoom(ctx, "outSlightly"),
          segs("y", [
            [0, 0.5, 100, -40],
            [0.5, 1, -40, 0],
          ]),
        ],
      };
    case E.glide:
      return {
        tracks: [
          fade(),
          whole("scaleX", 0, 1),
          whole("x", -ctx.w / 2 + K.glideX),
        ],
      };
    case E.flip:
      return {
        tracks: [
          whole("y", ctx.entrance ? -ctx.slideH : ctx.slideH),
          segs("scaleX", [
            [0, 0.25, 1, 0],
            [0.25, 0.5, 0, 1],
            [0.5, 0.75, 1, 0],
            [0.75, 1, 0, 1],
          ]),
          whole("rotate", K.flipRot),
        ],
      };
    case E.fold:
      return {
        tracks: [
          ...expandCompress(K.compressWidth),
          ...fly(ctx, DIR.bottom),
          whole("scaleY", 0.5, 1),
        ],
      };
    case E.credits:
      return {
        tracks: [whole("y", ctx.slideH, -ctx.slideH)],
        flash: "credits",
      };
    case E.easeIn:
      return ctx.entrance
        ? { tracks: [whole("cropL", ctx.w), whole("x", ctx.w / 2)] }
        : { tracks: [whole("alpha", 0, 1), whole("x", -ctx.w / 2)] };
    default:
      return { tracks: [fade()] };
  }
};

/**
 * Linear progress (0..1) with PowerPoint's accelerate/decelerate applied,
 * as in SMIL: constant acceleration, cruise, constant deceleration.
 */
export const smoothProgress = (t: number, accel: number, decel: number) => {
  const p = Math.min(1, Math.max(0, t));
  if (accel <= 0 && decel <= 0) return p;
  if (accel + decel > 1) {
    const total = accel + decel;
    accel /= total;
    decel /= total;
  }
  const rate = 1 / (1 - accel / 2 - decel / 2);
  if (p < accel) return (rate * p * p) / (2 * accel);
  if (p <= 1 - decel) return rate * (p - accel / 2);
  const rest = 1 - p;
  return 1 - (rate * rest * rest) / (2 * decel);
};

export const sampleTrack = (track: Track, t: number): number => {
  const { segments } = track;
  const first = segments[0];
  if (!first) return 0;
  if (t <= first.t0) return first.from;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (t < seg.t0) return segments[i - 1]?.to ?? seg.from;
    if (t <= seg.t1) {
      const span = seg.t1 - seg.t0;
      const k = span > 0 ? (t - seg.t0) / span : 1;
      return seg.from + (seg.to - seg.from) * k;
    }
  }
  return segments[segments.length - 1]!.to;
};
