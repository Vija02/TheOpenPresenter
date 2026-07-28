import { z } from "zod";

import { shadowValidator, strokeValidator } from "./paint";

export const horizontalAlignments = ["left", "center", "right"] as const;
export type HorizontalAlignment = (typeof horizontalAlignments)[number];

export const verticalAlignments = ["top", "center", "bottom"] as const;
export type VerticalAlignment = (typeof verticalAlignments)[number];

/**
 * - `declared`: use `style.fontSize` verbatim, no measurement.
 * - `shrink`: measure offscreen via SVG `getBBox` and let the viewBox scale it.
 *   Resize free, but cannot word wrap since `tspan` has no wrapping.
 * - `wrap`: binary search the largest size that fits a detached DOM node.
 *   Required for prose. Must re-run on resize.
 */
export const textFitModes = ["declared", "shrink", "wrap"] as const;
export type TextFitMode = (typeof textFitModes)[number];

/** Scalars are design units. Partial styles exist only as `TextStylePatch`. */
export const textStyleValidator = z.object({
  fontFamily: z.string(),
  /** Design units. Only used when element's `fit` = `declared`. */
  fontSize: z.number(),
  fontWeight: z.number(),
  fontStyle: z.enum(["normal", "italic"]),
  color: z.string(),
  align: z.enum(horizontalAlignments),
  valign: z.enum(verticalAlignments),
  lineHeight: z.number(),
  /** Design units. */
  letterSpacing: z.number(),
  /** Multiplies with the element's own opacity, as nested CSS opacity does. */
  opacity: z.number(),
  shadows: z.array(shadowValidator),
  /** Glyph outline */
  outline: strokeValidator.nullable(),
});

export type TextStyle = z.infer<typeof textStyleValidator>;

export const textStylePatchValidator = textStyleValidator.partial();
export type TextStylePatch = z.infer<typeof textStylePatchValidator>;

/**
 * Omits what cannot apply to an inline span: `fontSize` is absolute design
 * units where a span needs `fontScale` off the resolved size, and `align`
 * /`valign` are block level.
 */
export const spanRoleStyleValidator = textStylePatchValidator
  .omit({ fontSize: true, align: true, valign: true })
  .extend({
    /** Multiplier of the element's resolved font size. */
    fontScale: z.number().optional(),
    /** CSS `vertical-align`. Distinct from the block level `valign`. */
    verticalAlign: z.enum(["baseline", "super", "sub"]).optional(),
    /** Design units. */
    marginAfter: z.number().optional(),
  });

export type SpanRoleStyle = z.infer<typeof spanRoleStyleValidator>;
