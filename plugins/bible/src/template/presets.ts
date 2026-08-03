import {
  DEFAULT_FONT_STACK,
  DataBinding,
  HorizontalAlignment,
  LayoutDoc,
  Rect,
  Shadow,
  Template,
  createLayoutDoc,
  createShapeElement,
  createTextElement,
  solidPaint,
} from "@repo/layout";

import {
  BACKGROUND_ELEMENT_ID,
  BODY_ELEMENT_ID,
  REFERENCE_ELEMENT_ID,
} from "./ids";

export const bibleBindings: DataBinding[] = [
  { key: "verses", label: "Verse text", type: "richText" },
  { key: "reference", label: "Reference", type: "text" },
  { key: "translation", label: "Translation", type: "text" },
];

const shadow = (blur: number, color: string): Shadow => ({
  x: 0,
  y: 0,
  blur,
  spread: 0,
  color,
  inner: false,
});

export const softShadows: Shadow[] = [
  shadow(0.25, "rgba(0,0,0,0.9)"),
  shadow(0.5, "rgba(0,0,0,0.6)"),
];

/** Design units — 1 unit is 1% of slide width, so 6 is ~115px on a 1920px slide */
const BODY_FONT_SIZE = 6;
/** The reference is a caption by default, a heading when big. */
const REFERENCE_FONT_SIZE = 2.8;
const BIG_REFERENCE_FONT_SIZE = 6;

// Locked by default
export const backgroundElement = (color: string) =>
  createShapeElement({
    id: BACKGROUND_ELEMENT_ID,
    name: "Background",
    kind: "rect",
    rect: { x: 0, y: 0, w: 100, h: 100 },
    fill: solidPaint(color),
    locked: true,
  });

const verseNumberRole = {
  fontScale: 0.6,
  verticalAlign: "super" as const,
  opacity: 0.7,
  fontWeight: 400,
  marginAfter: 0.25,
};

export type BibleDocOptions = {
  body: Rect;
  reference: Rect;
  background?: string;
  color?: string;
  fontFamily?: string;
  fontWeight?: number;
  align?: HorizontalAlignment;
  bodyFontSize?: number;
  shadows?: Shadow[];
  showReference?: boolean;
  referenceAlign?: HorizontalAlignment;
  referenceFontSize?: number;
  referenceFontWeight?: number;
  /** Captions sit back at 0.85; a heading-sized reference wants full weight. */
  referenceOpacity?: number;
};

export const bibleDoc = ({
  body,
  reference,
  background = "#000000",
  color = "#ffffff",
  fontFamily = DEFAULT_FONT_STACK,
  fontWeight = 600,
  align = "center",
  bodyFontSize = BODY_FONT_SIZE,
  shadows = softShadows,
  showReference = true,
  referenceAlign,
  referenceFontSize = REFERENCE_FONT_SIZE,
  referenceFontWeight = 400,
  referenceOpacity = 0.85,
}: BibleDocOptions): LayoutDoc =>
  createLayoutDoc({
    fitMode: "fluid",
    elements: [
      backgroundElement(background),
      createTextElement({
        id: BODY_ELEMENT_ID,
        name: "Verse text",
        rect: body,
        fit: "shrinkToFit",
        content: "{{verses}}",
        style: {
          fontFamily,
          fontSize: bodyFontSize,
          fontWeight,
          color,
          align,
          valign: "center",
          lineHeight: 1.15,
          shadows,
        },
        spanRoles: { verseNumber: verseNumberRole },
      }),
      createTextElement({
        id: REFERENCE_ELEMENT_ID,
        name: "Reference",
        rect: reference,
        fit: "shrinkToFit",
        content: "{{reference}} ({{translation}})",
        hidden: !showReference,
        hideWhenEmpty: true,
        opacity: referenceOpacity,
        style: {
          fontFamily,
          fontSize: referenceFontSize,
          fontWeight: referenceFontWeight,
          color,
          align: referenceAlign ?? align,
          valign: "center",
          shadows: shadows.slice(0, 1),
        },
      }),
    ],
  });

export const bibleTemplates: Template[] = [
  {
    id: "centered-reference-below",
    name: "Centered, reference below",
    bindings: bibleBindings,
    doc: bibleDoc({
      body: { x: 6, y: 6, w: 88, h: 77.5 },
      reference: { x: 6, y: 85.5, w: 88, h: 8.5 },
    }),
  },
  {
    id: "centered-reference-above",
    name: "Centered, reference above",
    bindings: bibleBindings,
    doc: bibleDoc({
      body: { x: 6, y: 17, w: 88, h: 77 },
      reference: { x: 6, y: 6, w: 88, h: 8 },
    }),
  },
  {
    id: "centered-no-reference",
    name: "Centered, no reference",
    bindings: bibleBindings,
    doc: bibleDoc({
      body: { x: 8, y: 12, w: 84, h: 76 },
      reference: { x: 8, y: 90, w: 84, h: 8 },
      showReference: false,
    }),
  },
  {
    id: "big-reference-above",
    name: "Big reference above",
    bindings: bibleBindings,
    doc: bibleDoc({
      body: { x: 8, y: 30, w: 84, h: 62 },
      reference: { x: 8, y: 10, w: 84, h: 14 },
      referenceFontSize: BIG_REFERENCE_FONT_SIZE,
      referenceFontWeight: 700,
      referenceOpacity: 1,
    }),
  },
  {
    id: "left-reference-below",
    name: "Left aligned, reference below",
    bindings: bibleBindings,
    doc: bibleDoc({
      body: { x: 8, y: 8, w: 84, h: 74 },
      reference: { x: 8, y: 85, w: 84, h: 8 },
      align: "left",
    }),
  },
  {
    id: "left-big-reference",
    name: "Left aligned, big reference",
    bindings: bibleBindings,
    doc: bibleDoc({
      body: { x: 8, y: 32, w: 84, h: 60 },
      reference: { x: 8, y: 10, w: 84, h: 14 },
      align: "left",
      referenceFontSize: BIG_REFERENCE_FONT_SIZE,
      referenceFontWeight: 700,
      referenceOpacity: 1,
    }),
  },
  {
    // Transparent background
    id: "lower-third",
    name: "Lower third, left aligned",
    bindings: bibleBindings,
    doc: bibleDoc({
      body: { x: 6, y: 60, w: 88, h: 26 },
      reference: { x: 6, y: 87, w: 88, h: 7 },
      background: "rgba(0,0,0,0)",
      align: "left",
    }),
  },
];

export const DEFAULT_TEMPLATE_ID = "centered-reference-below";

export const findTemplate = (id: string): Template | null =>
  bibleTemplates.find((t) => t.id === id) ?? null;

export const defaultBibleTemplate = (): Template =>
  findTemplate(DEFAULT_TEMPLATE_ID) ?? bibleTemplates[0]!;

export const resolveBibleDoc = (template?: LayoutDoc | null): LayoutDoc =>
  template ?? defaultBibleTemplate().doc;
