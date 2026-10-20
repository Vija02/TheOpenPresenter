import type {
  OfficeAnimKind,
  OfficeAnimStart,
  OfficeAnimation,
  OfficeBackground,
  OfficeDuration,
  OfficeMedia,
  OfficeMorphFrame,
  OfficePathCommand,
  OfficeRegion,
  OfficeRepeat,
  OfficeShape,
  OfficeSlide,
  OfficeSprite,
  OfficeTransition,
} from "./types";

/**
 * Converts the slideshow service's `GetSlide` JSON (`CT_SlideShowInfo`) into our
 * own model. Field meanings come from PowerPoint for the web's own parser
 * (`DataParser.parseSlideInfo`); enum values are noted where they are decoded.
 *
 * Image and media ids are kept as-is; the importer maps them to stored files.
 */

type Raw = Record<string, any>;

const KINDS: OfficeAnimKind[] = [
  "entrance",
  "exit",
  "emphasis",
  "path",
  "action",
  "media",
];
// ST_AnimStart: c, w, a
const STARTS: OfficeAnimStart[] = ["click", "with", "after"];
// ST_HideAfterAnimType: non, imm, clk
const HIDE_AFTER = ["none", "immediately", "nextClick"] as const;

const isType = (value: Raw | null | undefined, name: string) =>
  typeof value?.__type === "string" && value.__type.startsWith(`${name}:`);

const toRegion = (reg: Raw | null | undefined): OfficeRegion | null => {
  if (!reg || typeof reg.imgID !== "string" || !reg.imgID) return null;
  return {
    img: reg.imgID,
    x: reg.x ?? 0,
    y: reg.y ?? 0,
    w: reg.w ?? 0,
    h: reg.h ?? 0,
  };
};

const toSprite = (
  reg: Raw | null | undefined,
  pos: Raw | null | undefined,
): OfficeSprite | null => {
  const region = toRegion(reg);
  if (!region) return null;
  return { x: pos?.x ?? 0, y: pos?.y ?? 0, region };
};

const hex = (n: number) =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0");

/** Solid fills carry a transparency percent, which PowerPoint blends onto white */
const solidColor = (clr: number[] | undefined, transp: number | undefined) => {
  const [r = 255, g = 255, b = 255] = clr ?? [];
  const a = (transp ?? 0) / 100;
  const blend = (c: number) => 255 * a + (1 - a) * c;
  return `#${hex(blend(r))}${hex(blend(g))}${hex(blend(b))}`;
};

export const normalizeBackground = (bg: Raw | null | undefined) => {
  const item = bg?.Item;
  if (isType(item, "CT_ImageBackground")) {
    const region = toRegion(item);
    if (region) {
      return {
        type: "image",
        sprite: { x: 0, y: 0, region },
      } satisfies OfficeBackground;
    }
  }
  if (isType(item, "CT_SolidFill")) {
    return {
      type: "color",
      color: solidColor(item.clr, item.transp),
    } satisfies OfficeBackground;
  }
  return { type: "color", color: "#ffffff" } satisfies OfficeBackground;
};

export const parseDuration = (spd: unknown): OfficeDuration => {
  if (spd === "sld") return { type: "untilSlide" };
  if (spd === "clk") return { type: "untilClick" };
  if (spd === undefined || spd === null || spd === "def") {
    return { type: "timed", ms: 2000 };
  }
  const ms = parseInt(String(spd), 10);
  return { type: "timed", ms: Number.isFinite(ms) ? ms : 2000 };
};

const parseRepeat = (repeat: Raw | null | undefined): OfficeRepeat => {
  if (!repeat) return 0;
  // ST_AnimRepeatType: cnt, clk, sld
  if (repeat.type === 1) return "untilClick";
  if (repeat.type === 2) return "untilSlide";
  return typeof repeat.count === "number" ? repeat.count : 0;
};

const parsePath = (mp: Raw | null | undefined) => {
  if (!mp || !Array.isArray(mp.Items)) return null;
  const commands: OfficePathCommand[] = [];
  for (const item of mp.Items as Raw[]) {
    if (isType(item, "CT_MotionPathMoveCmd")) {
      commands.push({ type: "M", x: item.x, y: item.y });
    } else if (isType(item, "CT_MotionPathLineCmd")) {
      commands.push({ type: "L", x: item.x, y: item.y });
    } else if (isType(item, "CT_MotionPathCurveCmd")) {
      commands.push({
        type: "C",
        x1: item.x1,
        y1: item.y1,
        x2: item.x2,
        y2: item.y2,
        x: item.x3,
        y: item.y3,
      });
    }
  }
  return commands.length ? { commands, reversed: !!mp.rev } : null;
};

export const normalizeAnimation = (anim: Raw): OfficeAnimation => {
  const base = anim.empImgs?.base;
  return {
    shapeId: Number(anim.sp),
    kind: KINDS[anim.effectType] ?? "entrance",
    effectId: anim.effectId ?? 0,
    direction: anim.dir ?? 0,
    start: STARTS[anim.timing?.st] ?? "click",
    delayMs: anim.timing?.off ?? 0,
    duration: parseDuration(anim.timing?.spd),
    childDelayMs:
      typeof anim.iter?.interval === "number" ? anim.iter.interval : -1,
    repeat: parseRepeat(anim.repeat),
    rewind: !!anim.rewind,
    autoReverse: !!anim.autoRev,
    hideAfter: HIDE_AFTER[anim.hideAfter] ?? "none",
    scaleX: anim.scaleBy ? anim.scaleBy.x / 1000 : 100,
    scaleY: anim.scaleBy ? anim.scaleBy.y / 1000 : 100,
    rotateDeg: (anim.rotAng ?? 0) / 1000,
    transparency: anim.transp ?? 0,
    smoothStart: (anim.smSt ?? 0) / 100,
    smoothEnd: (anim.smEnd ?? 0) / 100,
    emphasisSprite: base ? toSprite(base.reg, base.pos) : null,
    path: parsePath(anim.mp),
  };
};

const normalizeMedia = (media: Raw | null | undefined): OfficeMedia | null => {
  const item = media?.Item;
  const local = isType(item, "CT_MediaLocal");
  if (!local && !isType(item, "CT_MediaLink")) return null;
  return {
    id: local && typeof item.id === "string" ? item.id : null,
    ...(!local && typeof item.src === "string" ? { url: item.src } : {}),
    contentType: item.ct ?? "",
    autoPlay: !!item.autoPlay,
    // ST repeat: 0 plays once, 4294967295 loops
    loop: !!item.repeat,
    volume: typeof item.volume === "number" ? item.volume : 1,
    trimStartMs: item.trimStart ?? 0,
    trimEndMs: item.trimEnd ?? 0,
    durationMs: item.dur ?? 0,
  };
};

const normalizeShape = (sp: Raw): OfficeShape | null => {
  const children = Array.isArray(sp.children)
    ? (sp.children as Raw[])
        .map((child) => toSprite(child.reg, child.pos))
        .filter((child): child is OfficeSprite => child !== null)
    : [];
  const region = toRegion(sp.reg);
  // Text built letter by letter has no image of its own, only its pieces
  if (!region && children.length === 0) return null;
  const media = normalizeMedia(sp.media);
  return {
    id: Number(sp.id),
    x: sp.pos?.x ?? 0,
    y: sp.pos?.y ?? 0,
    region,
    children,
    ...(media ? { media } : {}),
  };
};

/**
 * The service turns PowerPoint's "play video" command into a stand-in: a 100%
 * Grow/Shrink on the video's poster image (same place and size as the video)
 * that lasts as long as the video. Its own player ignores it and only plays on
 * a click on the video. Ours has no clicks on the output, so read the stand-in
 * as "play here". Seen on one capture; see docs/OFFICE-ONLINE-SLIDESHOW.md.
 */
const MEDIA_STAND_IN_EFFECT = 6;
const mediaStandIns = (
  animations: OfficeAnimation[],
  shapes: OfficeShape[],
): OfficeAnimation[] => {
  const mediaShapes = shapes.filter((shape) => shape.media && shape.region);
  if (!mediaShapes.length) return animations;
  return animations.map((anim) => {
    if (
      anim.kind !== "emphasis" ||
      anim.effectId !== MEDIA_STAND_IN_EFFECT ||
      anim.scaleX !== 100 ||
      anim.scaleY !== 100
    ) {
      return anim;
    }
    const poster = shapes.find((shape) => shape.id === anim.shapeId);
    const video = mediaShapes.find(
      (shape) =>
        poster?.region &&
        shape.x === poster.x &&
        shape.y === poster.y &&
        shape.region!.w === poster.region.w &&
        shape.region!.h === poster.region.h,
    );
    return video ? { ...anim, kind: "media", shapeId: video.id } : anim;
  });
};

/** One side of a morph pair (`keyFrameA`/`keyFrameB`), or null when absent */
const normalizeMorphFrame = (frame: Raw | null | undefined) => {
  if (!frame) return null;
  const shapes: OfficeMorphFrame["shapes"] = Array.isArray(frame.spIdLst)
    ? (frame.spIdLst as Raw[]).map((sp) => {
        const pieces = String(sp.chdSpLst ?? "")
          .split(" ")
          .filter(Boolean)
          .map(Number);
        return { id: Number(sp.spId), pieces: pieces.length ? pieces : null };
      })
    : frame.id
      ? [{ id: Number(frame.id), pieces: null }]
      : [];
  if (!frame.isBg && !shapes.length && !frame.w && !frame.h) return null;
  return {
    cx: frame.cx ?? 0,
    cy: frame.cy ?? 0,
    w: frame.w ?? 0,
    h: frame.h ?? 0,
    // a2 is the same angle in 1/65536ths of a degree, when present
    rotateDeg:
      typeof frame.a2 === "number" && frame.a2
        ? frame.a2 / 65536
        : (frame.a ?? 0),
    z: frame.z ?? 0,
    shapes,
  } satisfies OfficeMorphFrame;
};

const normalizeTransition = (trans: Raw | null | undefined) => {
  if (!trans || !trans.type) return null;
  const morph = Array.isArray(trans.morph)
    ? (trans.morph as Raw[]).map((pair) => ({
        background: !!(pair.keyFrameA?.isBg || pair.keyFrameB?.isBg),
        from: normalizeMorphFrame(pair.keyFrameA),
        to: normalizeMorphFrame(pair.keyFrameB),
      }))
    : null;
  return {
    type: trans.type,
    durationMs: trans.dur ?? 0,
    direction: trans.dir ?? 0,
    ...(morph?.length ? { morph } : {}),
  } satisfies OfficeTransition;
};

export const normalizeSlide = (sld: Raw): OfficeSlide => {
  const shapes = ((sld.spLst ?? []) as Raw[])
    .map(normalizeShape)
    .filter((shape): shape is OfficeShape => shape !== null);
  const advanceAfter =
    sld.ssTimes?.autoAdv && typeof sld.ssTimes.autoAdvTime === "number"
      ? sld.ssTimes.autoAdvTime
      : null;
  return {
    id: String(sld.id),
    hidden: !!sld.hidden,
    background: normalizeBackground(sld.bg),
    shapes,
    animations: mediaStandIns(
      ((sld.animLst?.anim ?? []) as Raw[]).map(normalizeAnimation),
      shapes,
    ),
    triggers: ((sld.animSeqs ?? []) as Raw[])
      .filter((seq) => Array.isArray(seq?.anim))
      .map((seq) => ({
        id: String(seq.id),
        animations: (seq.anim as Raw[]).map(normalizeAnimation),
      })),
    transition: normalizeTransition(sld.trans),
    advance: {
      onClick: sld.ssTimes ? sld.ssTimes.manualAdv !== false : true,
      afterMs: advanceAfter,
    },
  };
};

/** Every sprite sheet id a slide refers to */
export const collectSlideImageIds = (slide: OfficeSlide): Set<string> => {
  const ids = new Set<string>();
  const add = (sprite: OfficeSprite | null) => {
    if (sprite) ids.add(sprite.region.img);
  };
  if (slide.background.type === "image") add(slide.background.sprite);
  for (const shape of slide.shapes) {
    if (shape.region) ids.add(shape.region.img);
    shape.children.forEach(add);
  }
  for (const anim of [
    ...slide.animations,
    ...slide.triggers.flatMap((t) => t.animations),
  ]) {
    add(anim.emphasisSprite);
  }
  return ids;
};
