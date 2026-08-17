import {
  LayoutDoc,
  cloneDoc,
  createLayoutDoc,
  createShapeElement,
  imagePaint,
  solidPaint,
} from "@repo/layout";
import { UniversalURL, extractMediaName } from "@repo/lib";
import { typeidUnboxed } from "typeid-js";

import { createSlideRef, parseSlideRef } from "./slideOrderUtils";
import {
  defaultCustomSlideTemplate,
  findCustomSlideTemplate,
} from "./template/presets";
import { CustomImportData, ImportData } from "./types";

/**
 * Helpers for custom (in-app authored) slide decks
 */

export const CUSTOM_DECK_DEFAULT_NAME = "Custom slides";

export const isCustomImport = (
  importData: ImportData | undefined,
): importData is CustomImportData => importData?.type === "custom";

// One slide doc
export const createCustomSlideDoc = (templateId?: string): LayoutDoc => {
  const template =
    (templateId ? findCustomSlideTemplate(templateId) : null) ??
    defaultCustomSlideTemplate();
  return cloneDoc(template.doc);
};

// The whole deck import
export const createCustomImport = ({
  name = CUSTOM_DECK_DEFAULT_NAME,
  templateId,
}: { name?: string; templateId?: string } = {}): CustomImportData => ({
  importId: typeidUnboxed("import"),
  type: "custom",
  name,
  fetchId: typeidUnboxed("fetch"),
  thumbnailLinks: [],
  slideClickCounts: [0],
  slideIds: [typeidUnboxed("slide")],
  docs: [createCustomSlideDoc(templateId)],
  _isFetching: false,
});

export const newCustomSlideId = (): string => typeidUnboxed("slide");

const thumbnailToUniversalURL = (thumbnailUrl: string): UniversalURL => {
  if (/^https?:\/\//.test(thumbnailUrl)) return thumbnailUrl;
  const { mediaId, extension } = extractMediaName(thumbnailUrl);
  return { mediaId, extension };
};

/**
 * A layout document generated for single pictures
 * Used to render other imports
 */
export const imageSlideDoc = (thumbnailUrl: string): LayoutDoc =>
  createLayoutDoc({
    fitMode: "fluid",
    elements: [
      createShapeElement({
        id: "background",
        name: "Background",
        kind: "rect",
        rect: { x: 0, y: 0, w: 100, h: 100 },
        fill: solidPaint("#000000"),
        locked: true,
      }),
      createShapeElement({
        id: "image",
        name: "Image",
        kind: "rect",
        rect: { x: 0, y: 0, w: 100, h: 100 },
        fill: imagePaint(thumbnailToUniversalURL(thumbnailUrl), "contain"),
      }),
    ],
  });

export const rebuildOrderAfterSlideRemoval = (
  slideOrder: string[],
  importId: string,
  removedIndex: number,
): string[] => {
  const rebuilt: string[] = [];

  for (const ref of slideOrder) {
    const parsed = parseSlideRef(ref);

    if (parsed.importId !== importId) {
      rebuilt.push(ref);
      continue;
    }

    if (parsed.slideIndex === removedIndex) continue;

    rebuilt.push(
      parsed.slideIndex > removedIndex
        ? createSlideRef(importId, parsed.slideIndex - 1)
        : ref,
    );
  }

  return rebuilt;
};

export const insertPositionForNewSlide = (
  slideOrder: string[],
  importId: string,
): number => {
  for (let i = slideOrder.length - 1; i >= 0; i--) {
    const ref = slideOrder[i];
    if (ref && parseSlideRef(ref).importId === importId) return i + 1;
  }
  return slideOrder.length;
};
