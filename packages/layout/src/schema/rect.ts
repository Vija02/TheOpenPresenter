import { z } from "zod";

/**
 * COORDINATE SYSTEM
 *
 * No pixels in the model, so a document is resolution independent. Two kinds of
 * number appear:
 *
 * 1. Rect components, percent of the design box. x/w of WIDTH, y/h of HEIGHT.
 * 2. Scalars (font size, letter spacing, stroke width, radius, padding) in
 *    design units, where 1 unit = 1% of box WIDTH.
 *
 * Scalars are width driven and therefore uniform: 2.8 is 2.8% of the width at
 * any box aspect, so text never distorts when the output shape changes.
 */
export const rectValidator = z.object({
  /** Left edge, percent of box width */
  x: z.number(),
  /** Top edge, percent of box height */
  y: z.number(),
  /** Width, percent of box width */
  w: z.number(),
  /** Height, percent of box height */
  h: z.number(),
});

export type Rect = z.infer<typeof rectValidator>;

export const FULL_BLEED: Rect = { x: 0, y: 0, w: 100, h: 100 };
