import { z } from "zod";

import { shadowValidator, strokeValidator } from "./paint";

export const horizontalAlignments = ["left", "center", "right"] as const;
export type HorizontalAlignment = (typeof horizontalAlignments)[number];

export const verticalAlignments = ["top", "center", "bottom"] as const;
export type VerticalAlignment = (typeof verticalAlignments)[number];

/**
 * How a text element's font size is decided.
 *
 * - `declared`: use `style.fontSize` verbatim. No measurement, so long text
 *   overflows its box.
 * - `shrinkToFit`: `style.fontSize` is a CEILING. Text renders at that size
 *   until it would overflow, then shrinks (wrapping) until it fits. The usual
 *   choice for authored text that occasionally runs long.
 * - `fitNoWrap`: largest size that fits WITHOUT wrapping — only explicit
 *   newlines break a line. For titles and references, where reflowing looks
 *   wrong.
 * - `wrap`: largest size that fits, wrapping freely. For prose, where the box
 *   should always be filled.
 */
export const textFitModes = [
  "declared",
  "shrinkToFit",
  "fitNoWrap",
  "wrap",
] as const;
export type TextFitMode = (typeof textFitModes)[number];

export const textTransforms = [
  "none",
  "uppercase",
  "lowercase",
  "capitalize",
] as const;
export type TextTransform = (typeof textTransforms)[number];

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
  shadows: z.array(shadowValidator),
  /** Glyph outline */
  outline: strokeValidator.nullable(),
  textTransform: z.enum(textTransforms).default("none"),
  /** Inset between the element's box and its text, in design units. */
  padding: z.number().default(0),
  /** When true, `padding` applies to all four sides. */
  paddingIsLinked: z.boolean().default(true),
  paddingTop: z.number().default(0),
  paddingRight: z.number().default(0),
  paddingBottom: z.number().default(0),
  paddingLeft: z.number().default(0),
});

export type TextStyle = z.infer<typeof textStyleValidator>;

/** Design units, in CSS order: top, right, bottom, left. */
export type PaddingSides = [number, number, number, number];

export const resolvePadding = (
  style: Partial<
    Pick<
      TextStyle,
      | "padding"
      | "paddingIsLinked"
      | "paddingTop"
      | "paddingRight"
      | "paddingBottom"
      | "paddingLeft"
    >
  >,
): PaddingSides => {
  // Defaults to linked
  if (style.paddingIsLinked ?? true) {
    const all = style.padding ?? 0;
    return [all, all, all, all];
  }
  return [
    style.paddingTop ?? 0,
    style.paddingRight ?? 0,
    style.paddingBottom ?? 0,
    style.paddingLeft ?? 0,
  ];
};

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
    /** Per-span opacity */
    opacity: z.number().optional(),
    /** CSS `vertical-align`. Distinct from the block level `valign`. */
    verticalAlign: z.enum(["baseline", "super", "sub"]).optional(),
    /** Design units. */
    marginAfter: z.number().optional(),
  });

export type SpanRoleStyle = z.infer<typeof spanRoleStyleValidator>;
