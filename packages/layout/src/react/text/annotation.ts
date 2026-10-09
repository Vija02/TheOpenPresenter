import { CSSProperties } from "react";

import { SpanRoleStyle } from "../../schema/style";
import { ANNOTATION_SCALE } from "../../template/spans";

/**
 * An annotated span is two stacked boxes, the annotation over the text. As an
 * inline block, its baseline is the text's, so the text stays on the line and
 * the annotation takes room above it. Shared by render and measure, so both
 * lay out the same
 */
export const annotatedStyle: CSSProperties = {
  display: "inline-block",
  verticalAlign: "baseline",
};

export const annotationStyle = (
  role: SpanRoleStyle | undefined,
): CSSProperties => ({
  display: "block",
  fontSize: `${role?.fontScale ?? ANNOTATION_SCALE}em`,
  fontWeight: role?.fontWeight,
  fontStyle: role?.fontStyle,
  fontFamily: role?.fontFamily,
  color: role?.color,
  opacity: role?.opacity,
  lineHeight: 1.2,
  // Over the start of its text, whatever the element's alignment
  textAlign: "start",
  textTransform: "none",
  paddingRight: "0.5em",
});

export const annotatedTextStyle: CSSProperties = {
  display: "block",
  textAlign: "start",
};

/** Keeps a line box under an annotation with no text of its own */
export const EMPTY_ANNOTATED_TEXT = "\u200B";

const toKebab = (key: string) =>
  key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export const toCssText = (style: CSSProperties): string =>
  Object.entries(style)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${toKebab(key)}:${value}`)
    .join(";");
