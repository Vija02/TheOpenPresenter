import { z } from "zod";

import { layoutElementValidator } from "./element";

export const LAYOUT_DOC_VERSION = 1;

export const aspectRatioValidator = z.object({
  width: z.number(),
  height: z.number(),
});
export type AspectRatio = z.infer<typeof aspectRatioValidator>;

/**
 * How a document reconciles its design aspect ratio with the box it is handed.
 *
 * - `fluid` (default): rects resolve against the ACTUAL box, and the scalar
 *   unit is driven by actual width. The layout stretches to fill whatever it is
 *   given.
 *
 * - `letterbox`: the design aspect is preserved and centred, with bars. Exact
 *   WYSIWYG, for precisely composed templates (lower thirds, title cards) where
 *   stretching would look wrong.
 */
export const layoutFitModes = ["fluid", "letterbox"] as const;
export type LayoutFitMode = (typeof layoutFitModes)[number];

export const layoutDocValidator = z.object({
  version: z.literal(LAYOUT_DOC_VERSION),
  aspectRatio: aspectRatioValidator,
  fitMode: z.enum(layoutFitModes),
  /** Array order is paint order */
  elements: z.array(layoutElementValidator),
});

export type LayoutDoc = z.infer<typeof layoutDocValidator>;

/** The shape of the value a binding resolves to, which is what the editor keys off. */
export const bindingTypes = ["text", "richText", "image"] as const;
export type BindingType = (typeof bindingTypes)[number];

/** A token the DATA PROVIDER (the plugin) offers */
export const dataBindingValidator = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(bindingTypes),
});
export type DataBinding = z.infer<typeof dataBindingValidator>;

export const templateValidator = z.object({
  id: z.string(),
  name: z.string(),
  doc: layoutDocValidator,
  bindings: z.array(dataBindingValidator),
});

export type Template = z.infer<typeof templateValidator>;
