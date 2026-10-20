/**
 * A PowerPoint deck as PowerPoint for the web plays it.
 *
 * Captured once at import from the Office Online slideshow service (see
 * `src/importers/office/fetchOfficeSlideshow.ts`), then played back by our own
 * renderer with no further calls to Microsoft. Every coordinate is in the pixel
 * space the server rendered at (`width` x `height`).
 */
export type OfficeDeck = {
  width: number;
  height: number;
  /** Sprite sheet id -> media file name, as thumbnails store them */
  images: Record<string, string>;
  /**
   * Sprite sheet id -> its size, so a smaller copy can be drawn at the
   * original's size. Missing on early imports, which only use full size
   */
  imageSizes?: Record<string, { w: number; h: number }>;
  /** Embedded video/audio id -> media file name */
  media?: Record<string, string>;
  slides: OfficeSlide[];
};

/** A rectangle cut out of one sprite sheet */
export type OfficeRegion = {
  img: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

/** One image placed on the slide */
export type OfficeSprite = {
  x: number;
  y: number;
  region: OfficeRegion;
};

export type OfficeShape = {
  id: number;
  x: number;
  y: number;
  /** Null when everything is in `children`, e.g. text built letter by letter */
  region: OfficeRegion | null;
  /**
   * Per-paragraph/word/letter images, used when an animation builds the shape
   * piece by piece (`childDelayMs >= 0`)
   */
  children: OfficeSprite[];
  media?: OfficeMedia;
};

/** A video or sound placed on the slide */
export type OfficeMedia = {
  /** Key into `OfficeDeck.media`, or null for a linked file */
  id: string | null;
  /** Linked (not embedded) file's address */
  url?: string;
  contentType: string;
  autoPlay: boolean;
  loop: boolean;
  /** 0..1 */
  volume: number;
  trimStartMs: number;
  trimEndMs: number;
  durationMs: number;
};

export type OfficeBackground =
  | { type: "color"; color: string }
  | { type: "image"; sprite: OfficeSprite };

export type OfficeAnimKind =
  | "entrance"
  | "exit"
  | "emphasis"
  | "path"
  | "action"
  /** Plays the video/sound on shape `shapeId` */
  | "media";

export type OfficeAnimStart = "click" | "with" | "after";

/**
 * `timed` plays for `ms`; the others hold until the next click / end of slide
 */
export type OfficeDuration =
  | { type: "timed"; ms: number }
  | { type: "untilClick" }
  | { type: "untilSlide" };

/** Extra plays after the first, or until a click / the end of the slide */
export type OfficeRepeat = number | "untilClick" | "untilSlide";

export type OfficePathCommand =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | {
      type: "C";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      x: number;
      y: number;
    };

export type OfficeAnimation = {
  shapeId: number;
  kind: OfficeAnimKind;
  /** PowerPoint preset id. Meaning depends on `kind`, see `effects.ts` */
  effectId: number;
  /** PowerPoint preset subtype (direction flags) */
  direction: number;
  start: OfficeAnimStart;
  delayMs: number;
  duration: OfficeDuration;
  /** Stagger between pieces when building by paragraph/word/letter. -1 when whole */
  childDelayMs: number;
  repeat: OfficeRepeat;
  rewind: boolean;
  autoReverse: boolean;
  hideAfter: "none" | "immediately" | "nextClick";
  /** Grow/Shrink target, in percent */
  scaleX: number;
  scaleY: number;
  /** Spin amount, in degrees */
  rotateDeg: number;
  /** Transparency emphasis amount, in percent */
  transparency: number;
  /** Fraction of the duration spent accelerating / decelerating */
  smoothStart: number;
  smoothEnd: number;
  /** Pre-rendered "after" look for colour-change emphasis effects */
  emphasisSprite: OfficeSprite | null;
  path: { commands: OfficePathCommand[]; reversed: boolean } | null;
};

export type OfficeTransition = {
  type: number;
  durationMs: number;
  direction: number;
  /** Morph: objects matched between the previous slide (`from`) and this one */
  morph?: OfficeMorphPair[];
};

/** Where one matched object sits on its slide, and which sprites draw it */
export type OfficeMorphFrame = {
  /** Centre and size of the object's box, in slide pixels */
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotateDeg: number;
  /** Stacking order */
  z: number;
  /** Shapes on that slide; `pieces` picks children, null means the whole shape */
  shapes: { id: number; pieces: number[] | null }[];
};

/** Null on one side when the object only exists on the other slide */
export type OfficeMorphPair = {
  background: boolean;
  from: OfficeMorphFrame | null;
  to: OfficeMorphFrame | null;
};

export type OfficeSlide = {
  id: string;
  hidden: boolean;
  background: OfficeBackground;
  shapes: OfficeShape[];
  /** The main click sequence */
  animations: OfficeAnimation[];
  /** Interactive (trigger) sequences, keyed by id. Kept for later; not played yet */
  triggers: { id: string; animations: OfficeAnimation[] }[];
  transition: OfficeTransition | null;
  advance: { onClick: boolean; afterMs: number | null };
};
