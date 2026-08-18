import { DEFAULT_FONT_STACK, LayoutDoc, Rect, Template, createLayoutDoc, createShapeElement, createTextElement, solidPaint } from "@repo/layout";


export const BACKGROUND_ELEMENT_ID = "background";
export const TITLE_ELEMENT_ID = "title";
export const BODY_ELEMENT_ID = "body";
export const BODY_LEFT_ELEMENT_ID = "body-left";
export const BODY_RIGHT_ELEMENT_ID = "body-right";
export const ATTRIBUTION_ELEMENT_ID = "attribution";
export const ACCENT_ELEMENT_ID = "accent";

const DEFAULT_BACKGROUND = "#ffffff";
const DEFAULT_COLOR = "#1a1a1a";

const TITLE_FONT_SIZE = 9;
const BODY_FONT_SIZE = 4.5;
const SECTION_FONT_SIZE = 11;

/** Locked so a click on the slide body selects the text, not the backdrop. */
const backgroundElement = (color: string = DEFAULT_BACKGROUND) =>
  createShapeElement({
    id: BACKGROUND_ELEMENT_ID,
    name: "Background",
    kind: "rect",
    rect: { x: 0, y: 0, w: 100, h: 100 },
    fill: solidPaint(color),
    locked: true,
  });

type TitleOptions = {
  id?: string;
  name?: string;
  rect: Rect;
  content: string;
  fontSize?: number;
  fontWeight?: number;
  align?: "left" | "center" | "right";
  valign?: "top" | "center" | "bottom";
};

const titleElement = ({
  id = TITLE_ELEMENT_ID,
  name = "Title",
  rect,
  content,
  fontSize = TITLE_FONT_SIZE,
  fontWeight = 700,
  align = "center",
  valign = "center",
}: TitleOptions) =>
  createTextElement({
    id,
    name,
    rect,
    fit: "shrinkToFit",
    content,
    hideWhenEmpty: true,
    style: {
      fontFamily: DEFAULT_FONT_STACK,
      fontSize,
      fontWeight,
      color: DEFAULT_COLOR,
      align,
      valign,
      lineHeight: 1.1,
    },
  });

type BodyOptions = {
  id?: string;
  name?: string;
  rect: Rect;
  content: string;
  fontSize?: number;
  align?: "left" | "center" | "right";
  valign?: "top" | "center" | "bottom";
};

const bodyElement = ({
  id = BODY_ELEMENT_ID,
  name = "Body",
  rect,
  content,
  fontSize = BODY_FONT_SIZE,
  align = "left",
  valign = "top",
}: BodyOptions) =>
  createTextElement({
    id,
    name,
    rect,
    fit: "shrinkToFit",
    content,
    hideWhenEmpty: true,
    style: {
      fontFamily: DEFAULT_FONT_STACK,
      fontSize,
      fontWeight: 400,
      color: DEFAULT_COLOR,
      align,
      valign,
      lineHeight: 1.35,
    },
  });

const blankDoc = (): LayoutDoc =>
  createLayoutDoc({ fitMode: "fluid", elements: [backgroundElement()] });

const titleDoc = (): LayoutDoc =>
  createLayoutDoc({
    fitMode: "fluid",
    elements: [
      backgroundElement(),
      titleElement({
        rect: { x: 8, y: 30, w: 84, h: 26 },
        content: "Title",
      }),
      bodyElement({
        id: "subtitle",
        name: "Subtitle",
        rect: { x: 8, y: 58, w: 84, h: 12 },
        content: "Subtitle",
        fontSize: 4,
        align: "center",
        valign: "top",
      }),
    ],
  });

const titleBodyDoc = (): LayoutDoc =>
  createLayoutDoc({
    fitMode: "fluid",
    elements: [
      backgroundElement(),
      titleElement({
        rect: { x: 8, y: 9, w: 84, h: 16 },
        content: "Title",
        fontSize: 7,
        align: "left",
        valign: "center",
      }),
      bodyElement({
        rect: { x: 8, y: 29, w: 84, h: 60 },
        content: "Your content here",
      }),
    ],
  });

const sectionDoc = (): LayoutDoc =>
  createLayoutDoc({
    fitMode: "fluid",
    elements: [
      backgroundElement(),
      createShapeElement({
        id: ACCENT_ELEMENT_ID,
        name: "Accent bar",
        kind: "rect",
        rect: { x: 8, y: 60, w: 16, h: 1.2 },
        fill: solidPaint("#3b82f6"),
      }),
      titleElement({
        rect: { x: 8, y: 36, w: 84, h: 20 },
        content: "Section",
        fontSize: SECTION_FONT_SIZE,
        align: "left",
        valign: "bottom",
      }),
    ],
  });

const twoContentDoc = (): LayoutDoc =>
  createLayoutDoc({
    fitMode: "fluid",
    elements: [
      backgroundElement(),
      titleElement({
        rect: { x: 8, y: 9, w: 84, h: 14 },
        content: "Title",
        fontSize: 7,
        align: "left",
        valign: "center",
      }),
      bodyElement({
        id: BODY_LEFT_ELEMENT_ID,
        name: "Left content",
        rect: { x: 8, y: 28, w: 40, h: 62 },
        content: "Left column",
      }),
      bodyElement({
        id: BODY_RIGHT_ELEMENT_ID,
        name: "Right content",
        rect: { x: 52, y: 28, w: 40, h: 62 },
        content: "Right column",
      }),
    ],
  });

const quoteDoc = (): LayoutDoc =>
  createLayoutDoc({
    fitMode: "fluid",
    elements: [
      backgroundElement(),
      createTextElement({
        id: BODY_ELEMENT_ID,
        name: "Quote",
        rect: { x: 10, y: 22, w: 80, h: 46 },
        fit: "shrinkToFit",
        content: "“Your quote here”",
        hideWhenEmpty: true,
        style: {
          fontFamily: DEFAULT_FONT_STACK,
          fontSize: 6.5,
          fontWeight: 500,
          fontStyle: "italic",
          color: DEFAULT_COLOR,
          align: "center",
          valign: "center",
          lineHeight: 1.25,
        },
      }),
      bodyElement({
        id: ATTRIBUTION_ELEMENT_ID,
        name: "Attribution",
        rect: { x: 10, y: 72, w: 80, h: 8 },
        content: "- Attribution",
        fontSize: 3.4,
        align: "center",
        valign: "top",
      }),
    ],
  });

export const customSlideTemplates: Template[] = [
  { id: "blank", name: "Blank", bindings: [], doc: blankDoc() },
  { id: "title", name: "Title", bindings: [], doc: titleDoc() },
  { id: "title-body", name: "Title & body", bindings: [], doc: titleBodyDoc() },
  { id: "section", name: "Section header", bindings: [], doc: sectionDoc() },
  {
    id: "two-content",
    name: "Two content",
    bindings: [],
    doc: twoContentDoc(),
  },
  { id: "quote", name: "Quote", bindings: [], doc: quoteDoc() },
];

export const DEFAULT_TEMPLATE_ID = "title-body";

export const findCustomSlideTemplate = (id: string): Template | null =>
  customSlideTemplates.find((t) => t.id === id) ?? null;

export const defaultCustomSlideTemplate = (): Template =>
  findCustomSlideTemplate(DEFAULT_TEMPLATE_ID) ?? customSlideTemplates[0]!;