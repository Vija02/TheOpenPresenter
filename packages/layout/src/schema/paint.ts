import { universalURLValidator } from "@repo/lib";
import { z } from "zod";

export const solidPaintValidator = z.object({
  type: z.literal("solid"),
  /** Any CSS colour. */
  color: z.string(),
  opacity: z.number(),
});

export const linearGradientPaintValidator = z.object({
  type: z.literal("linearGradient"),
  /** Degrees, 0 = top-to-bottom. */
  angle: z.number(),
  stops: z.array(
    z.object({
      /** 0–1 along the gradient. */
      offset: z.number(),
      color: z.string(),
    }),
  ),
  opacity: z.number(),
});

export const paintValidator = z.discriminatedUnion("type", [
  solidPaintValidator,
  linearGradientPaintValidator,
]);

export const imageFitModes = ["contain", "cover", "fill"] as const;
export type ImageFitMode = (typeof imageFitModes)[number];

export const imagePaintValidator = z.object({
  type: z.literal("image"),
  src: universalURLValidator,
  fit: z.enum(imageFitModes),
  opacity: z.number(),
});

export const fillPaintValidator = z.discriminatedUnion("type", [
  solidPaintValidator,
  linearGradientPaintValidator,
  imagePaintValidator,
]);

export type SolidPaint = z.infer<typeof solidPaintValidator>;
export type LinearGradientPaint = z.infer<typeof linearGradientPaintValidator>;
export type ImagePaint = z.infer<typeof imagePaintValidator>;
export type Paint = z.infer<typeof paintValidator>;
export type FillPaint = z.infer<typeof fillPaintValidator>;

export const strokeAlignments = ["inside", "center", "outside"] as const;
export type StrokeAlignment = (typeof strokeAlignments)[number];

export const strokeValidator = z.object({
  paint: paintValidator,
  /** Design units. */
  width: z.number(),
  align: z.enum(strokeAlignments),
});

export type Stroke = z.infer<typeof strokeValidator>;

export const shadowValidator = z.object({
  /** Design units. */
  x: z.number(),
  y: z.number(),
  blur: z.number(),
  spread: z.number(),
  color: z.string(),
  inner: z.boolean(),
});

export type Shadow = z.infer<typeof shadowValidator>;

export const effectValidator = z.discriminatedUnion("type", [
  shadowValidator.extend({ type: z.literal("shadow") }),
  z.object({
    type: z.literal("blur"),
    /** Design units. */
    radius: z.number(),
  }),
]);

export type Effect = z.infer<typeof effectValidator>;

export const solidPaint = (color: string, opacity = 1): SolidPaint => ({
  type: "solid",
  color,
  opacity,
});

export const sortGradientStops = (
  stops: LinearGradientPaint["stops"],
): LinearGradientPaint["stops"] =>
  [...stops].sort((a, b) => a.offset - b.offset);

export const imagePaint = (
  src: ImagePaint["src"],
  fit: ImageFitMode = "cover",
  opacity = 1,
): ImagePaint => ({
  type: "image",
  src,
  fit,
  opacity,
});

export const linearGradientPaint = (
  angle: number,
  stops: LinearGradientPaint["stops"],
  opacity = 1,
): LinearGradientPaint => ({
  type: "linearGradient",
  angle,
  stops: sortGradientStops(stops),
  opacity,
});
