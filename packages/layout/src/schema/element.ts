import { z } from "zod";

import { effectValidator, fillPaintValidator, strokeValidator } from "./paint";
import { rectValidator } from "./rect";
import {
  spanRoleStyleValidator,
  textFitModes,
  textStyleValidator,
} from "./style";

/**
 * Fields shared by every element.
 *
 * Appearance (fill / stroke / effects / radius) lives here rather than per
 * type, following Figma: any layer can have a background, a border and shadows,
 * and the alternative is redeclaring them on each element kind.
 *
 * NOTE ON NULLABILITY: every optional-in-spirit field is `.nullable()`, never
 * `.optional()`. These objects are persisted into a Yjs document through
 * valtio-yjs, which does NOT support `undefined`
 */
export const elementBaseValidator = z.object({
  id: z.string(),
  /** Human-facing layer name */
  name: z.string().nullable(),
  rect: rectValidator,
  rotation: z.number(),
  opacity: z.number(),
  /** Editor-only: element cannot be selected or dragged. */
  locked: z.boolean(),
  /** Never rendered, in editor or output. */
  hidden: z.boolean(),
  /** Drop the element when its bound data resolves to nothing */
  hideWhenEmpty: z.boolean(),

  /** Background paint. For text this is the box, not the glyphs. */
  fill: fillPaintValidator.nullable(),
  /** Border. For text this is the box, not the glyphs. */
  stroke: strokeValidator.nullable(),
  /** Applied in order. Multiple shadows are normal, not exotic. */
  effects: z.array(effectValidator),
  /** Corner radius, design units. */
  radius: z.number(),
  /** Clip children to the element bounds (CSS overflow: hidden). */
  clip: z.boolean(),
});

export const textElementValidator = elementBaseValidator.extend({
  type: z.literal("text"),
  /** May contain `{{token}}` placeholders; resolved at render time, never stored resolved. */
  content: z.string(),
  fit: z.enum(textFitModes),
  style: textStyleValidator,
  /** Role name → style, for rich spans. See schema/style.ts. */
  spanRoles: z.record(z.string(), spanRoleStyleValidator).nullable(),
});

export const shapeKinds = ["rect", "ellipse", "line"] as const;
export type ShapeKind = (typeof shapeKinds)[number];

export const shapeElementValidator = elementBaseValidator.extend({
  type: z.literal("shape"),
  kind: z.enum(shapeKinds),
});

export const layoutElementValidator = z.discriminatedUnion("type", [
  textElementValidator,
  shapeElementValidator,
]);

export type ElementBase = z.infer<typeof elementBaseValidator>;
export type TextElement = z.infer<typeof textElementValidator>;
export type ShapeElement = z.infer<typeof shapeElementValidator>;
export type LayoutElement = z.infer<typeof layoutElementValidator>;
export type LayoutElementType = LayoutElement["type"];
