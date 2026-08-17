import { LayoutDoc, cloneDoc } from "@repo/layout";
import { useCallback, useMemo } from "react";

import {
  createCustomImport,
  createCustomSlideDoc,
  insertPositionForNewSlide,
  isCustomImport,
  newCustomSlideId,
} from "../../../src/customSlides";
import { createSlideRef, parseSlideRef } from "../../../src/slideOrderUtils";
import { CustomImportData } from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";

export type DeckSlide = {
  slideIndex: number;
  globalIndex: number;
  slideId: string;
  doc: LayoutDoc;
};

/**
 * A deck's slides ordered the way they will actually present.
 */
export const useDeckSlides = (importId: string | null): DeckSlide[] => {
  const pluginApi = usePluginAPI();
  const pluginData = pluginApi.scene.useData((x) => x.pluginData);

  return useMemo(() => {
    if (!importId) return [];
    const importData = pluginData.imports?.[importId];
    if (!isCustomImport(importData)) return [];

    const slides: DeckSlide[] = [];
    (pluginData.slideOrder ?? []).forEach((ref, globalIndex) => {
      const parsed = parseSlideRef(ref);
      if (parsed.importId !== importId) return;

      const doc = importData.docs[parsed.slideIndex];
      if (!doc) return;

      slides.push({
        slideIndex: parsed.slideIndex,
        globalIndex,
        slideId:
          importData.slideIds[parsed.slideIndex] ?? String(parsed.slideIndex),
        doc,
      });
    });
    return slides;
  }, [importId, pluginData]);
};

export const useCustomSlides = () => {
  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();
  const pluginId = pluginApi.pluginContext.pluginId;

  const { mutate: removeCustomSlideMutation } =
    trpc.slides.removeCustomSlide.useMutation();

  /** Creates a deck holding a single starter slide */
  const createDeck = useCallback(
    (templateId?: string): string => {
      const deck = createCustomImport({ templateId });
      const pluginData = mutableSceneData.pluginData;

      pluginData.imports[deck.importId] = deck;
      pluginData.slideOrder = [
        ...pluginData.slideOrder,
        createSlideRef(deck.importId, 0),
      ];

      return deck.importId;
    },
    [mutableSceneData],
  );

  /** Appends a slide to a deck */
  const addSlide = useCallback(
    (importId: string, templateId?: string): number | null => {
      const pluginData = mutableSceneData.pluginData;
      const deck = pluginData.imports[importId];
      if (!isCustomImport(deck)) return null;

      const target = deck as CustomImportData;
      const newIndex = target.docs.length;

      target.docs = [...target.docs, createCustomSlideDoc(templateId)];
      target.slideIds = [...target.slideIds, newCustomSlideId()];
      target.slideClickCounts = [...target.slideClickCounts, 0];

      const order = [...pluginData.slideOrder];
      order.splice(
        insertPositionForNewSlide(order, importId),
        0,
        createSlideRef(importId, newIndex),
      );
      pluginData.slideOrder = order;

      return newIndex;
    },
    [mutableSceneData],
  );

  const duplicateSlide = useCallback(
    (importId: string, slideIndex: number): number | null => {
      const pluginData = mutableSceneData.pluginData;
      const deck = pluginData.imports[importId];
      if (!isCustomImport(deck)) return null;

      const target = deck as CustomImportData;
      const source = target.docs[slideIndex];
      if (!source) return null;

      const newIndex = target.docs.length;

      target.docs = [...target.docs, cloneDoc(source)];
      target.slideIds = [...target.slideIds, newCustomSlideId()];
      target.slideClickCounts = [...target.slideClickCounts, 0];

      const order = [...pluginData.slideOrder];
      const sourcePos = order.indexOf(createSlideRef(importId, slideIndex));
      order.splice(
        sourcePos === -1 ? order.length : sourcePos + 1,
        0,
        createSlideRef(importId, newIndex),
      );
      pluginData.slideOrder = order;

      return newIndex;
    },
    [mutableSceneData],
  );

  const updateSlideDoc = useCallback(
    (importId: string, slideIndex: number, doc: LayoutDoc) => {
      const deck = mutableSceneData.pluginData.imports[importId];
      if (!isCustomImport(deck)) return;
      if (slideIndex >= deck.docs.length) return;

      (deck as CustomImportData).docs[slideIndex] = cloneDoc(doc);
    },
    [mutableSceneData],
  );

  const removeSlide = useCallback(
    (importId: string, slideIndex: number) => {
      removeCustomSlideMutation({ pluginId, importId, slideIndex });
    },
    [removeCustomSlideMutation, pluginId],
  );

  const moveSlide = useCallback(
    (importId: string, slideIndex: number, direction: "up" | "down") => {
      const pluginData = mutableSceneData.pluginData;
      const order = [...pluginData.slideOrder];

      const positions = order
        .map((ref, position) => ({ ref, position }))
        .filter(({ ref }) => parseSlideRef(ref).importId === importId);

      const at = positions.findIndex(
        ({ ref }) => parseSlideRef(ref).slideIndex === slideIndex,
      );
      const swapWith = direction === "up" ? at - 1 : at + 1;
      if (at === -1 || swapWith < 0 || swapWith >= positions.length) return;

      const a = positions[at]!.position;
      const b = positions[swapWith]!.position;
      [order[a], order[b]] = [order[b]!, order[a]!];

      pluginData.slideOrder = order;
    },
    [mutableSceneData],
  );

  return {
    createDeck,
    addSlide,
    duplicateSlide,
    updateSlideDoc,
    removeSlide,
    moveSlide,
  };
};
