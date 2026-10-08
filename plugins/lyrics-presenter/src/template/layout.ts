import { type LayoutDoc, type LayoutElement } from "@repo/layout";

import { type Background, backgroundFromMedia } from "../backgrounds";
import type { PluginBaseData, Song } from "../types";
import { BACKGROUND_ELEMENT_ID, LYRICS_TOKEN } from "./ids";
import { defaultLyricsTemplate } from "./presets";

type SceneLayout = Pick<PluginBaseData, "template" | "background">;

export const DEFAULT_SCENE_BACKGROUND: Background = backgroundFromMedia({
  type: "solid",
  color: "#000000",
});

export const sceneTemplate = (pluginData: Pick<SceneLayout, "template">) =>
  pluginData.template ?? defaultLyricsTemplate();

export const sceneBackground = (
  pluginData: Pick<SceneLayout, "background">,
): Background | null =>
  pluginData.background === undefined
    ? DEFAULT_SCENE_BACKGROUND
    : pluginData.background;

export const songTemplate = (
  song: Pick<Song, "template">,
  pluginData: Pick<SceneLayout, "template">,
): LayoutDoc => song.template ?? sceneTemplate(pluginData);

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
