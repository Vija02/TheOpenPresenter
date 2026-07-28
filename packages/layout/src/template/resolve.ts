import { LayoutDoc } from "../schema/document";
import {
  ImageElement,
  LayoutElement,
  ShapeElement,
  TextElement,
} from "../schema/element";
import { FrameData, Span, isSpansEmpty } from "./spans";
import { substituteSpans, substituteUniversalURL } from "./tokens";

/** A text element with its bindings resolved into styled spans. */
export type ResolvedTextElement = Omit<TextElement, "content"> & {
  spans: Span[];
};

export type ResolvedElement = ResolvedTextElement | ImageElement | ShapeElement;

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

const resolveElement = (
  element: LayoutElement,
  data: FrameData,
): ResolvedElement | null => {
  if (element.hidden) return null;

  switch (element.type) {
    case "text": {
      const { content, ...rest } = element;
      const spans = substituteSpans(content, data);
      if (element.hideWhenEmpty && isSpansEmpty(spans)) return null;
      return { ...rest, spans };
    }
    case "image": {
      const src = substituteUniversalURL(element.src, data);
      const isEmpty = typeof src === "string" && src.trim() === "";
      if (element.hideWhenEmpty && isEmpty) return null;
      return { ...element, src };
    }
    case "shape":
      // Shapes carry no bindings
      return element;
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
