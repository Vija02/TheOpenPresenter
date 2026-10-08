import type { DataBinding } from "@repo/base-types";
import {
  DEFAULT_FONT_STACK,
  FONT_OPTIONS,
  HorizontalAlignment,
  LayoutDoc,
  Rect,
  Shadow,
  Stroke,
  Template,
  TextFitMode,
  TextStylePatch,
  VerticalAlignment,
  createLayoutDoc,
  createTextElement,
  solidPaint,
} from "@repo/layout";

import {
  HEADING_ROLE,
  LYRICS_BODY_ELEMENT_ID,
  LYRICS_SECTION_ELEMENT_ID,
} from "./ids";

export const lyricsBindings: DataBinding[] = [
  { key: "lyrics", label: "Lyrics", type: "richText" },
  { key: "section", label: "Section name", type: "text" },
  { key: "title", label: "Song title", type: "text" },
  { key: "author", label: "Author", type: "text" },
];

/** Bundled, so every output shows the same, and the font picker knows it */
export const LYRICS_FONT_STACK =
  FONT_OPTIONS.find((font) => font.id === "inter")?.stack ?? DEFAULT_FONT_STACK;

const shadow = (blur: number, color: string): Shadow => ({
  x: 0,
  y: 0,
  blur,
  spread: 0,
  color,
  inner: false,
});

export const lyricsShadows: Shadow[] = [
  shadow(0.4, "rgba(0,0,0,0.9)"),
  shadow(0.8, "rgba(0,0,0,0.6)"),
];

export const lyricsOutline: Stroke = {
  paint: solidPaint("#000000"),
  width: 0.15,
  align: "center",
};

const headingRole = { fontScale: 0.6, opacity: 0.85 };

export type LyricsDocOptions = {
  body?: Rect;
  fit?: TextFitMode;
  style?: TextStylePatch;
  /** Adds a small section name element in this box */
  section?: Rect;
  sectionAlign?: HorizontalAlignment;
  sectionValign?: VerticalAlignment;
};

export const DEFAULT_LYRICS_RECT: Rect = { x: 4, y: 7, w: 92, h: 86 };

export const lyricsDoc = ({
  body = DEFAULT_LYRICS_RECT,
  fit = "fitNoWrap",
  style,
  section,
  sectionAlign = "center",
  sectionValign = "center",
}: LyricsDocOptions = {}): LayoutDoc => {
  const bodyStyle: TextStylePatch = {
    fontFamily: LYRICS_FONT_STACK,
    fontWeight: 600,
    color: "#FFFFFF",
    lineHeight: 1,
    shadows: lyricsShadows,
    outline: lyricsOutline,
    ...style,
  };

  return createLayoutDoc({
    fitMode: "fluid",
    elements: [
      createTextElement({
        id: LYRICS_BODY_ELEMENT_ID,
        name: "Lyrics",
        rect: body,
        fit,
        content: "{{lyrics}}",
        style: bodyStyle,
        spanRoles: { [HEADING_ROLE]: headingRole },
      }),
      ...(section
        ? [
            createTextElement({
              id: LYRICS_SECTION_ELEMENT_ID,
              name: "Section name",
              rect: section,
              fit: "fitNoWrap",
              content: "{{section}}",
              hideWhenEmpty: true,
              opacity: 0.75,
              style: {
                fontFamily: bodyStyle.fontFamily,
                fontWeight: 400,
                color: bodyStyle.color,
                align: sectionAlign,
                valign: sectionValign,
                shadows: lyricsShadows,
              },
            }),
          ]
        : []),
    ],
  });
};

/** Main slides: the lyrics over the whole screen */
export const mainTemplates: Template[] = [
  {
    id: "centered",
    name: "Centered",
    bindings: lyricsBindings,
    doc: lyricsDoc(),
  },
  {
    id: "top",
    name: "Top",
    bindings: lyricsBindings,
    doc: lyricsDoc({ style: { valign: "top" } }),
  },
  {
    id: "bottom",
    name: "Bottom",
    bindings: lyricsBindings,
    doc: lyricsDoc({ style: { valign: "bottom" } }),
  },
];

/** The whole song at once, flowing into columns */
export const fullSongTemplates: Template[] = [
  {
    id: "full-song",
    name: "Full song",
    bindings: lyricsBindings,
    doc: lyricsDoc({
      fit: "columns",
      style: { align: "left", valign: "top" },
    }),
  },
];

/** A couple of lines along the bottom, over other content */
export const lowerThirdTemplates: Template[] = [
  {
    id: "lower-third",
    name: "Lower third",
    bindings: lyricsBindings,
    doc: lyricsDoc({
      body: { x: 5, y: 72, w: 90, h: 22 },
      style: { valign: "bottom" },
    }),
  },
];

export const lyricsTemplates: Template[] = [
  ...mainTemplates,
  ...fullSongTemplates,
  ...lowerThirdTemplates,
];

export const findLyricsTemplate = (id: string): Template | null =>
  lyricsTemplates.find((t) => t.id === id) ?? null;
