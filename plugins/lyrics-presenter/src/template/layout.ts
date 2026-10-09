import {
  type LayoutDoc,
  type LayoutElement,
  type SpanRoleStyle,
} from "@repo/layout";

import type { Background } from "../backgrounds";
import {
  BACKGROUND_ELEMENT_ID,
  CHORD_ROLE,
  HEADING_ROLE,
  LIVE_CHORD_ROLE,
  LIVE_HEADING_ROLE,
  LIVE_ROLE,
  LYRICS_TOKEN,
} from "./ids";

const isBackgroundElement = (element: LayoutElement) =>
  element.id === BACKGROUND_ELEMENT_ID;

/** A template as drawn: without a background element, should one slip in */
export const textLayout = (doc: LayoutDoc): LayoutDoc =>
  doc.elements.some(isBackgroundElement)
    ? { ...doc, elements: doc.elements.filter((e) => !isBackgroundElement(e)) }
    : doc;

const showsLyrics = (element: LayoutElement) =>
  element.type === "text" && element.content.includes(`{{${LYRICS_TOKEN}`);

/** Full song flows the lyrics into columns, whatever the template's fit */
export const fullSongLayout = (doc: LayoutDoc): LayoutDoc => ({
  ...doc,
  elements: doc.elements.map(
    (element): LayoutElement =>
      element.type === "text" && showsLyrics(element)
        ? { ...element, fit: "columns" }
        : element,
  ),
});

/** How the live slide stands out, unless a template styles it */
const LIVE_COLOR = "#FACC15";

/**
 * Gives the lyrics styles for the live slide, where the template has none:
 * its usual heading and chord styles, in the live colour
 */
export const withLiveRole = (doc: LayoutDoc): LayoutDoc => ({
  ...doc,
  elements: doc.elements.map((element): LayoutElement => {
    if (element.type !== "text" || !showsLyrics(element)) return element;
    const roles = element.spanRoles ?? {};
    const live = (base: string): SpanRoleStyle => ({
      ...roles[base],
      color: LIVE_COLOR,
    });
    return {
      ...element,
      spanRoles: {
        [LIVE_ROLE]: { color: LIVE_COLOR },
        [LIVE_CHORD_ROLE]: live(CHORD_ROLE),
        [LIVE_HEADING_ROLE]: live(HEADING_ROLE),
        ...roles,
      },
    };
  }),
});

/** Where the template's lyrics go, for applying old style fields */
export const isLyricsElement = showsLyrics;

/**
 * A template with the background as its bottom layer. Only for pictures of
 * the whole slide, such as the template rail. Never stored or edited
 */
export const composeLayout = (
  template: LayoutDoc,
  background: Background | null,
): LayoutDoc => {
  const element = background?.elements[0];
  const text = textLayout(template);
  return element
    ? {
        ...text,
        elements: [{ ...element, id: BACKGROUND_ELEMENT_ID }, ...text.elements],
      }
    : text;
};
