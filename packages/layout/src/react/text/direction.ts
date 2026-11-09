import { CSSProperties } from "react";

import { TextDirection } from "../../schema/style";

/** Scripts written right to left. */
const RTL_LETTER =
  /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Adlam}\p{Script=Samaritan}\p{Script=Mandaic}]/u;
const LETTER = /\p{L}/u;

/**
 * The element's base direction. `auto` follows the first letter of the text,
 * like HTML `dir="auto"`. Text with no letters at all (numbers, an empty
 * token) reads left to right. Stops at the first letter, so long lyrics cost
 * no more than a short title.
 */
export const resolveTextDirection = (
  direction: TextDirection | undefined,
  spans: readonly { text: string }[],
): "ltr" | "rtl" => {
  if (direction === "ltr" || direction === "rtl") return direction;
  for (const span of spans) {
    for (const char of span.text) {
      if (LETTER.test(char)) return RTL_LETTER.test(char) ? "rtl" : "ltr";
    }
  }
  return "ltr";
};

/**
 * Put on each block that directly holds text. Under `auto`, every paragraph
 * (each line between newlines) then picks its own direction, so an English
 * line and an Arabic line can share one box. `unicode-bidi` is not
 * inherited, which is why this goes on the text blocks, not the element.
 */
export const paragraphBidi = (
  direction: TextDirection | undefined,
): CSSProperties =>
  direction === "ltr" || direction === "rtl"
    ? {}
    : { unicodeBidi: "plaintext" };
