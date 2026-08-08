import { LayoutDoc } from "../schema/document";
import { LayoutElement, ShapeElement, TextElement } from "../schema/element";
import { FillPaint } from "../schema/paint";
import { FrameData, Span, isSpansEmpty } from "./spans";
import { substituteSpans, substituteUniversalURL } from "./tokens";

/** A text element with its bindings resolved into styled spans. */
export type ResolvedTextElement = Omit<TextElement, "content"> & {
  spans: Span[];
};

export type ResolvedElement = ResolvedTextElement | ShapeElement;

export type ResolvedDoc = {
  doc: LayoutDoc;
  /** Visible elements only, in paint order. */
  elements: ResolvedElement[];
};

/** Exposed as the reserved `{{n}}` and `{{total}}` tokens. Both 1 based. */
export type FrameContext = {
  index?: number;
  total?: number;
};

const withReservedTokens = (
  data: FrameData,
  ctx: FrameContext | undefined,
): FrameData => {
  if (!ctx) return data;
  // Caller-supplied keys win: a plugin that means something specific by `n`
  // should not be overruled by the engine's convenience tokens.
  return {
    ...(ctx.index === undefined ? {} : { n: ctx.index }),
    ...(ctx.total === undefined ? {} : { total: ctx.total }),
    ...data,
  };
};

const resolveFill = (
  fill: FillPaint | null,
  data: FrameData,
): FillPaint | null => {
  if (fill?.type !== "image") return fill;
  return { ...fill, src: substituteUniversalURL(fill.src, data) };
};

const isEmptyImageFill = (fill: FillPaint | null): boolean =>
  fill?.type === "image" &&
  typeof fill.src === "string" &&
  fill.src.trim() === "";

const resolveElement = (
  element: LayoutElement,
  data: FrameData,
): ResolvedElement | null => {
  if (element.hidden) return null;

  const fill = resolveFill(element.fill, data);

  switch (element.type) {
    case "text": {
      const { content, ...rest } = element;
      const spans = substituteSpans(content, data);
      if (element.hideWhenEmpty && isSpansEmpty(spans)) return null;
      return { ...rest, fill, spans };
    }
    case "shape":
      // A shape's only binding is its image fill.
      if (element.hideWhenEmpty && isEmptyImageFill(fill)) return null;
      return { ...element, fill };
  }
};

export const resolveDoc = (
  doc: LayoutDoc,
  data: FrameData,
  ctx?: FrameContext,
): ResolvedDoc => {
  const merged = withReservedTokens(data, ctx);
  const elements: ResolvedElement[] = [];

  for (const element of doc.elements) {
    const resolved = resolveElement(element, merged);
    if (resolved !== null) elements.push(resolved);
  }

  return { doc, elements };
};
