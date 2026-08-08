import { DEFAULT_FONT_STACK } from "../fonts/registry";
import {
  AspectRatio,
  LAYOUT_DOC_VERSION,
  LayoutDoc,
  LayoutFitMode,
} from "./document";
import { ElementBase, ShapeElement, ShapeKind, TextElement } from "./element";
import { Effect, FillPaint, Stroke } from "./paint";
import { FULL_BLEED, Rect } from "./rect";
import { SpanRoleStyle, TextFitMode, TextStyle, TextStylePatch } from "./style";

export const DEFAULT_ASPECT_RATIO: AspectRatio = { width: 16, height: 9 };

export const defaultTextStyle: TextStyle = {
  fontFamily: DEFAULT_FONT_STACK,
  fontSize: 6,
  fontWeight: 600,
  fontStyle: "normal",
  color: "#ffffff",
  align: "center",
  valign: "center",
  lineHeight: 1.15,
  letterSpacing: 0,
  shadows: [],
  outline: null,
};

/** Appearance shared by every element kind. */
export type AppearanceOptions = {
  name?: string | null;
  rect?: Rect;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
  hidden?: boolean;
  hideWhenEmpty?: boolean;
  fill?: FillPaint | null;
  stroke?: Stroke | null;
  effects?: Effect[];
  radius?: number;
  clip?: boolean;
};

const baseElement = (
  id: string,
  {
    name = null,
    rect = FULL_BLEED,
    rotation = 0,
    opacity = 1,
    locked = false,
    hidden = false,
    hideWhenEmpty = false,
    fill = null,
    stroke = null,
    effects = [],
    radius = 0,
    clip = false,
  }: AppearanceOptions,
): ElementBase => ({
  id,
  name,
  rect,
  rotation,
  opacity,
  locked,
  hidden,
  hideWhenEmpty,
  fill,
  stroke,
  effects,
  radius,
  clip,
});

/** `id` is always explicit */
export type CreateTextElementOptions = AppearanceOptions & {
  id: string;
  content: string;
  fit?: TextFitMode;
  style?: TextStylePatch;
  spanRoles?: Record<string, SpanRoleStyle> | null;
};

export const createTextElement = ({
  id,
  content,
  fit = "declared",
  style,
  spanRoles = null,
  ...appearance
}: CreateTextElementOptions): TextElement => ({
  ...baseElement(id, appearance),
  type: "text",
  content,
  fit,
  style: { ...defaultTextStyle, ...style },
  spanRoles,
});

export type CreateShapeElementOptions = AppearanceOptions & {
  id: string;
  kind?: ShapeKind;
};

export const createShapeElement = ({
  id,
  kind = "rect",
  ...appearance
}: CreateShapeElementOptions): ShapeElement => ({
  ...baseElement(id, appearance),
  type: "shape",
  kind,
});

export type CreateLayoutDocOptions = {
  aspectRatio?: AspectRatio;
  fitMode?: LayoutFitMode;
  elements?: LayoutDoc["elements"];
};

export const createLayoutDoc = ({
  aspectRatio = DEFAULT_ASPECT_RATIO,
  fitMode = "fluid",
  elements = [],
}: CreateLayoutDocOptions = {}): LayoutDoc => ({
  version: LAYOUT_DOC_VERSION,
  aspectRatio,
  fitMode,
  elements,
});
