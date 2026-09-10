import type { Plugin, ServerPluginApi } from "@repo/base-plugin/server";
import { typeidUnboxed } from "typeid-js";

import { deleteOldMedia } from "./shared";
import { createSlideRef, parseSlideRef } from "./slideOrderUtils";
import type { BaseImportData, ImportData, PluginBaseData } from "./types";

export const createImportHelpers = (serverPluginApi: ServerPluginApi) => {
  const cleanupImportMedia = (importData: ImportData) => {
    if (importData.pdfMediaName) {
      deleteOldMedia(serverPluginApi, [importData.pdfMediaName]);
    }
  };

  const getBaseImport = (
    type: ImportData["type"],
    name?: string,
    replaceImportId?: string,
  ): BaseImportData => ({
    importId: typeidUnboxed("import"),
    type,
    name,
    fetchId: typeidUnboxed("fetch"),
    thumbnailLinks: [],
    slideClickCounts: [],
    slideIds: [],
    _isFetching: true,
    ...(replaceImportId && { replaceImportId }),
  });

  const buildReplacedSlideOrder = (
    oldOrder: string[],
    replaceImportId: string,
    newImportId: string,
    newSlideCount: number,
  ): string[] => {
    const survivingIndices = new Set<number>();
    const rebuilt: string[] = [];
    let lastSurvivingPos = -1;

    for (const ref of oldOrder) {
      const { importId, slideIndex } = parseSlideRef(ref);

      // Refs from other imports stay exactly where they are.
      if (importId !== replaceImportId) {
        rebuilt.push(ref);
        continue;
      }

      // Drop slides that no longer exist or that we've already kept.
      const slideStillExists = slideIndex < newSlideCount;
      const alreadyKept = survivingIndices.has(slideIndex);
      if (!slideStillExists || alreadyKept) continue;

      // Keep, rewriting to the new import id.
      survivingIndices.add(slideIndex);
      rebuilt.push(createSlideRef(newImportId, slideIndex));
      lastSurvivingPos = rebuilt.length - 1;
    }

    // Append brand-new slides after the last surviving slide of this import.
    const newSlides: string[] = [];
    for (let i = 0; i < newSlideCount; i++) {
      if (!survivingIndices.has(i)) {
        newSlides.push(createSlideRef(newImportId, i));
      }
    }
    if (newSlides.length > 0) {
      const insertAt =
        lastSurvivingPos >= 0 ? lastSurvivingPos + 1 : rebuilt.length;
      rebuilt.splice(insertAt, 0, ...newSlides);
    }

    return rebuilt;
  };

  /**
   * Handles both appending & replacing
   */
  const finalizeImport = ({
    loadedPlugin,
    newImportId,
    slideCount,
    replaceImportId,
  }: {
    loadedPlugin: Plugin<PluginBaseData>;
    newImportId: string;
    slideCount: number;
    replaceImportId?: string;
  }) => {
    const oldImport = replaceImportId
      ? loadedPlugin.pluginData.imports[replaceImportId]
      : undefined;

    // Append functionality
    if (!replaceImportId || !oldImport) {
      const newRefs = Array.from({ length: slideCount }, (_, i) =>
        createSlideRef(newImportId, i),
      );
      loadedPlugin.pluginData.slideOrder = [
        ...loadedPlugin.pluginData.slideOrder,
        ...newRefs,
      ];
      return;
    }

    // Replace functionality

    // 1. Drop the old import from the imports map.
    const { [replaceImportId]: _removed, ...remainingImports } =
      loadedPlugin.pluginData.imports;
    loadedPlugin.pluginData.imports = remainingImports;

    // 2. Rebuild slideOrder, preserving manual ordering.
    loadedPlugin.pluginData.slideOrder = buildReplacedSlideOrder(
      loadedPlugin.pluginData.slideOrder,
      replaceImportId,
      newImportId,
      slideCount,
    );

    // 3. Clean up the thumbnails and uploaded PDF
    cleanupImportMedia(oldImport);
  };

  return { cleanupImportMedia, getBaseImport, finalizeImport };
};

export type ImportHelpers = ReturnType<typeof createImportHelpers>;
