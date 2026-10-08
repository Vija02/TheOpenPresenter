/**
 * Converts lyrics-presenter data from before it moved onto `@repo/layout`:
 * the old `SlideStyle` becomes a text template and a background. Pure, on
 * plain JSON, for `upgrade__v1_lyrics_layout`.
 *
 * A one-off, so it holds its own copy of the plugin's default template as it
 * was at the time, rather than depending on the plugin.
 */
import {
  DEFAULT_FONT_STACK,
  FONT_OPTIONS,
  type LayoutDoc,
  type Rect,
  type Shadow,
  type Stroke,
  type TextFitMode,
  type TextStyle,
  type TextStylePatch,
  createLayoutDoc,
  createShapeElement,
  createTextElement,
  solidPaint,
  toLayoutVideo,
  videoPaint,
} from "@repo/layout";

type LegacyVideo = Parameters<typeof toLayoutVideo>[0];

/** The old style. Every field optional, as overrides stored only changes */
export type LegacyStyle = {
  autoSize?: boolean;
  fontSize?: string | number;
  fontWeight?: string | number;
  fontStyle?: string;
  fontFamily?: string;
  lineHeight?: string | number;
  textColor?: string;
  textShadow?: boolean;
  textOutline?: boolean;
  backgroundType?: "solid" | "video";
  backgroundColor?: string;
  backgroundVideoMediaId?: string | null;
  verticalAlign?: "top" | "center" | "bottom";
  padding?: string | number;
  paddingIsLinked?: boolean;
  leftPadding?: string | number;
  topPadding?: string | number;
  rightPadding?: string | number;
  bottomPadding?: string | number;
};

type FullStyle = Required<Omit<LegacyStyle, "backgroundVideoMediaId">> & {
  backgroundVideoMediaId: string | null;
};

export type LegacySong = {
  styleOverride?: LegacyStyle | null;
  template?: LayoutDoc | null;
  background?: LayoutDoc | null;
  [key: string]: unknown;
};

export type LegacyPluginData = {
  style?: LegacyStyle;
  videoBackgrounds?: LegacyVideo[];
  songs?: LegacySong[];
  template?: LayoutDoc | null;
  background?: LayoutDoc | null;
  [key: string]: unknown;
};

// --- The plugin's defaults, as they were -----------------------------------

/** The system font list lyrics used before. It becomes `FONT_STACK` */
const OLD_DEFAULT_FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`;

/** Inter, from the editor's fonts: bundled, so every output shows the same */
const FONT_STACK =
  FONT_OPTIONS.find((font) => font.id === "inter")?.stack ?? DEFAULT_FONT_STACK;

const DEFAULT_STYLE: FullStyle = {
  autoSize: true,
  fontSize: 14,
  fontWeight: "600",
  fontStyle: "normal",
  fontFamily: FONT_STACK,
  lineHeight: 1,
  textColor: "#FFFFFF",
  textShadow: true,
  textOutline: true,
  backgroundType: "solid",
  backgroundColor: "#000000",
  backgroundVideoMediaId: null,
  verticalAlign: "center",
  padding: 4,
  paddingIsLinked: true,
  leftPadding: 4,
  topPadding: 4,
  rightPadding: 4,
  bottomPadding: 4,
};

const shadow = (blur: number, color: string): Shadow => ({
  x: 0,
  y: 0,
  blur,
  spread: 0,
  color,
  inner: false,
});

const SHADOWS: Shadow[] = [
  shadow(0.4, "rgba(0,0,0,0.9)"),
  shadow(0.8, "rgba(0,0,0,0.6)"),
];

const OUTLINE: Stroke = {
  paint: solidPaint("#000000"),
  width: 0.15,
  align: "center",
};

/** The plugin's "Centered" preset, which a null template stands for */
export const defaultLyricsTemplate = (): LayoutDoc =>
  createLayoutDoc({
    fitMode: "fluid",
    elements: [
      createTextElement({
        id: "lyrics-body",
        name: "Lyrics",
        rect: { x: 4, y: 7, w: 92, h: 86 },
        fit: "fitNoWrap",
        content: "{{lyrics}}",
        style: {
          fontFamily: FONT_STACK,
          fontWeight: 600,
          color: "#FFFFFF",
          lineHeight: 1,
          shadows: SHADOWS,
          outline: OUTLINE,
        },
        spanRoles: { heading: { fontScale: 0.6, opacity: 0.85 } },
      }),
    ],
  });

/** As the plugin's `backgroundFromMedia`, so equal media give equal keys */
const backgroundDoc = (
  fill: NonNullable<Parameters<typeof createShapeElement>[0]["fill"]>,
) =>
  createLayoutDoc({
    elements: [
      createShapeElement({
        id: "background",
        name: "Background",
        fill,
        locked: true,
      }),
    ],
  });

// --- Old style -> text -------------------------------------------------------

const toNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return undefined;
  const num = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(num) ? num : undefined;
};

const fullStyle = (
  ...layers: (LegacyStyle | null | undefined)[]
): FullStyle => {
  const out = { ...DEFAULT_STYLE } as Record<string, unknown>;
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer ?? {})) {
      if (value !== undefined && key in DEFAULT_STYLE) out[key] = value;
    }
  }
  return out as FullStyle;
};

/** Manual sizes were "points" of 1/280 of the width. Design units are 1/100 */
export const legacyFontSizeToUnits = (fontSize: string | number) =>
  ((toNumber(fontSize) ?? 14) * 100) / 280;

const TEXT_FIELDS = [
  "autoSize",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontFamily",
  "lineHeight",
  "textColor",
  "textShadow",
  "textOutline",
  "verticalAlign",
  "padding",
  "paddingIsLinked",
  "leftPadding",
  "topPadding",
  "rightPadding",
  "bottomPadding",
] as const;

const PADDING_FIELDS = [
  "padding",
  "paddingIsLinked",
  "leftPadding",
  "topPadding",
  "rightPadding",
  "bottomPadding",
] as const;

const BACKGROUND_FIELDS = [
  "backgroundType",
  "backgroundColor",
  "backgroundVideoMediaId",
] as const;

const hasAny = (
  style: LegacyStyle | null | undefined,
  fields: readonly (keyof LegacyStyle)[],
) =>
  !!style &&
  fields.some((key) => style[key] !== undefined && style[key] !== null);

/**
 * Padding was in percent of the width on every side. Rects are percent of
 * each axis, so vertical sides scale by the aspect lyrics was designed for
 */
const LEGACY_ASPECT = 16 / 9;
/** Linked padding never took more than half the height */
const MAX_LINKED_PADDING = 50 / LEGACY_ASPECT;

const paddingRect = (style: LegacyStyle): Rect | undefined => {
  if (!hasAny(style, PADDING_FIELDS)) return undefined;

  const side = (value: LegacyStyle["padding"]) =>
    Math.max(0, toNumber(value) ?? Number(DEFAULT_STYLE.padding));

  const linked = style.paddingIsLinked ?? true;
  const all = Math.min(side(style.padding), MAX_LINKED_PADDING);
  const [top, right, bottom, left] = linked
    ? [all, all, all, all]
    : [
        side(style.topPadding),
        side(style.rightPadding),
        side(style.bottomPadding),
        side(style.leftPadding),
      ];

  const y = top * LEGACY_ASPECT;
  return {
    x: left,
    y,
    w: Math.max(1, 100 - left - right),
    h: Math.max(1, 100 - y - bottom * LEGACY_ASPECT),
  };
};

/** The text fields a (possibly partial) style sets, as layout values */
export const legacyTextPatch = (
  style: LegacyStyle,
): { fit?: TextFitMode; rect?: Rect; style: TextStylePatch } => {
  const patch: Partial<TextStyle> = {};
  let fit: TextFitMode | undefined;

  if (style.autoSize === true) fit = "fitNoWrap";
  if (style.autoSize === false) {
    // Manual sizes wrapped and were cut off. Shrinking is kinder
    fit = "shrinkToFit";
    patch.fontSize = legacyFontSizeToUnits(style.fontSize ?? 14);
  } else if (style.fontSize !== undefined) {
    patch.fontSize = legacyFontSizeToUnits(style.fontSize);
  }

  const fontWeight = toNumber(style.fontWeight);
  if (fontWeight !== undefined) patch.fontWeight = fontWeight;
  if (style.fontStyle !== undefined) {
    patch.fontStyle = style.fontStyle === "italic" ? "italic" : "normal";
  }
  if (style.fontFamily !== undefined) {
    patch.fontFamily =
      style.fontFamily === OLD_DEFAULT_FONT ? FONT_STACK : style.fontFamily;
  }
  const lineHeight = toNumber(style.lineHeight);
  if (lineHeight !== undefined) patch.lineHeight = lineHeight;
  if (style.textColor !== undefined) patch.color = style.textColor;
  if (style.textShadow !== undefined) {
    patch.shadows = style.textShadow ? SHADOWS : [];
  }
  if (style.textOutline !== undefined) {
    patch.outline = style.textOutline ? OUTLINE : null;
  }
  if (style.verticalAlign !== undefined) patch.valign = style.verticalAlign;

  // Padding becomes the box itself, so the background around it can be
  // picked in the editor
  return { fit, rect: paddingRect(style), style: patch };
};

const isLyricsElement = (element: LayoutDoc["elements"][number]) =>
  element.type === "text" && element.content.includes("{{lyrics");

/** A template with a style's text fields applied to its lyrics */
export const applyLegacyStyle = (
  template: LayoutDoc,
  style: LegacyStyle,
): LayoutDoc => {
  const { fit, rect, style: patch } = legacyTextPatch(style);
  const doc: LayoutDoc = {
    ...template,
    elements: template.elements.map((element) =>
      element.type === "text" && isLyricsElement(element)
        ? {
            ...element,
            fit: fit ?? element.fit,
            rect: rect ?? element.rect,
            style: { ...element.style, ...patch },
          }
        : element,
    ),
  };
  // Also drops anything undefined, which Yjs can't hold
  return JSON.parse(JSON.stringify(doc)) as LayoutDoc;
};

// --- Old style -> background -------------------------------------------------

export const backgroundFromLegacyStyle = (
  style: FullStyle,
  legacyVideos: LegacyVideo[],
): LayoutDoc | null => {
  if (style.backgroundType === "video") {
    const video = legacyVideos.find(
      (x) => x.id === style.backgroundVideoMediaId,
    );
    return video
      ? backgroundDoc(videoPaint(toLayoutVideo(video), "cover", 1, "loop"))
      : null;
  }
  return backgroundDoc(solidPaint(style.backgroundColor));
};

// --- Songs and scenes --------------------------------------------------------

export type LegacyContext = {
  /** The scene's old style, which a song's override was on top of */
  legacyStyle: LegacyStyle | undefined;
  legacyVideos: LegacyVideo[];
  /** The scene's template, already converted. Null is the default */
  template: LayoutDoc | null;
};

export const isLegacySong = (song: LegacySong) => song.template === undefined;

/**
 * Overrides only stored what differed from the scene, but padding and a
 * manual size are only meaningful whole. Fill those groups from the scene's
 * style, so a song that changed one side keeps the scene's other three
 */
const completeOverride = (
  override: LegacyStyle,
  merged: FullStyle,
): LegacyStyle => {
  const out: LegacyStyle = { ...override };
  if (PADDING_FIELDS.some((key) => override[key] !== undefined)) {
    for (const key of PADDING_FIELDS) {
      (out as Record<string, unknown>)[key] = merged[key];
    }
  }
  if (merged.autoSize === false && override.fontSize === undefined) {
    out.fontSize = merged.fontSize;
  }
  return out;
};

/**
 * A song's own template only when its override changed the text, and its own
 * background only when it changed that. Null otherwise: follow the scene
 */
export const convertSong = (
  song: LegacySong,
  context: LegacyContext,
): { template: LayoutDoc | null; background: LayoutDoc | null } => {
  const override = song.styleOverride ?? undefined;
  const merged = fullStyle(context.legacyStyle, override);

  const template = hasAny(override, TEXT_FIELDS)
    ? applyLegacyStyle(
        context.template ?? defaultLyricsTemplate(),
        completeOverride(override!, merged),
      )
    : null;

  const background =
    song.background ??
    (hasAny(override, BACKGROUND_FIELDS)
      ? backgroundFromLegacyStyle(merged, context.legacyVideos)
      : null);

  return { template, background };
};

export type SceneConversion = {
  /** Undefined when the scene itself was already converted */
  scene?: { template: LayoutDoc | null; background: LayoutDoc | null };
  /** By index into `songs`, only those that needed it */
  songs: Map<
    number,
    { template: LayoutDoc | null; background: LayoutDoc | null }
  >;
};

/** Null when there is nothing left to convert */
export const convertPluginData = (
  pluginData: LegacyPluginData,
): SceneConversion | null => {
  const sceneDone = pluginData.template !== undefined;

  const scene = sceneDone
    ? undefined
    : {
        template: pluginData.style
          ? applyLegacyStyle(
              defaultLyricsTemplate(),
              fullStyle(pluginData.style),
            )
          : null,
        background: backgroundFromLegacyStyle(
          fullStyle(pluginData.style),
          pluginData.videoBackgrounds ?? [],
        ),
      };

  const context: LegacyContext = {
    legacyStyle: pluginData.style,
    legacyVideos: pluginData.videoBackgrounds ?? [],
    template: scene ? scene.template : (pluginData.template ?? null),
  };

  const songs = new Map<
    number,
    { template: LayoutDoc | null; background: LayoutDoc | null }
  >();
  (pluginData.songs ?? []).forEach((song, index) => {
    if (isLegacySong(song)) songs.set(index, convertSong(song, context));
  });

  return scene || songs.size > 0 ? { scene, songs } : null;
};

/** A songbook song isn't tied to a scene, so it converts against the defaults */
export const convertSavedSong = (
  song: LegacySong,
  legacyVideos: LegacyVideo[],
): LegacySong | null =>
  isLegacySong(song)
    ? {
        ...song,
        ...convertSong(song, {
          legacyStyle: undefined,
          legacyVideos,
          template: null,
        }),
      }
    : null;
