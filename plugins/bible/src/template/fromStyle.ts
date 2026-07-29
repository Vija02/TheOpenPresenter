import {
  LayoutDoc,
  createLayoutDoc,
  createTextElement,
  solidPaint,
} from "@repo/layout";

import { getBibleStyle } from "../style/style";
import { BibleSlideStyle } from "../types";

export const BODY_ELEMENT_ID = "bible-body";
export const REFERENCE_ELEMENT_ID = "bible-reference";

const REFERENCE_FONT_SIZE = 2.8;

const shadow = (blur: number, color: string) => ({
  x: 0,
  y: 0,
  blur,
  spread: 0,
  color,
  inner: false,
});

export const bibleDocFromStyle = (
  style?: BibleSlideStyle | null,
): LayoutDoc => {
  const s = getBibleStyle(style);

  const shadows = s.textShadow
    ? [shadow(0.25, "rgba(0,0,0,0.9)"), shadow(0.5, "rgba(0,0,0,0.6)")]
    : [];

  return createLayoutDoc({
    fitMode: "fluid",
    elements: [
      createTextElement({
        id: BODY_ELEMENT_ID,
        rect: { x: 6, y: 6, w: 88, h: 77.5 },
        fit: "wrap",
        content: "{{verses}}",
        style: {
          fontFamily: s.fontFamily,
          fontWeight: s.fontWeight,
          color: s.textColor,
          align: s.textAlign,
          valign: "center",
          lineHeight: 1.15,
          shadows,
        },
        spanRoles: {
          verseNumber: {
            fontScale: 0.6,
            verticalAlign: "super",
            opacity: 0.7,
            fontWeight: 400,
            marginAfter: 0.25,
          },
        },
      }),
      createTextElement({
        id: REFERENCE_ELEMENT_ID,
        rect: { x: 6, y: 85.5, w: 88, h: 8.5 },
        fit: "declared",
        content: "{{reference}} ({{translation}})",
        hidden: !s.showReference,
        hideWhenEmpty: true,
        style: {
          fontFamily: s.fontFamily,
          fontSize: REFERENCE_FONT_SIZE,
          fontWeight: 400,
          color: s.textColor,
          align: "center",
          valign: "center",
          opacity: 0.85,
          shadows: shadows.slice(0, 1),
        },
      }),
    ],
  });
};

export const bibleBackground = (style?: BibleSlideStyle | null): string =>
  solidPaint(getBibleStyle(style).backgroundColor).color;
