import type { ServerPluginApi } from "@repo/base-plugin/server";

import {
  loadedPlugins,
  loadedRendererDataGetter,
  loadedYjsData,
} from "../loadedState";
import { parseSlideRef } from "../slides/order";
import { deleteOldMedia } from "./pdfPipeline";

/**
 * Drop an entire import and every slide it contributed.
 */
export const createRemoveImportById =
  (serverPluginApi: ServerPluginApi) =>
  (pluginId: string, importId: string) => {
    const loadedPlugin = loadedPlugins[pluginId]!;
    const loadedYjs = loadedYjsData[pluginId]!;
    const getRendererData = loadedRendererDataGetter[pluginId];

    const importData = loadedPlugin.pluginData.imports[importId];
    if (!importData) return;

    if (importData.pdfMediaName) {
      deleteOldMedia(serverPluginApi, [importData.pdfMediaName]);
    }

    const oldSlideOrder = [...loadedPlugin.pluginData.slideOrder];
    const newSlideOrder = oldSlideOrder.filter(
      (ref) => parseSlideRef(ref).importId !== importId,
    );

    loadedYjs.doc?.transact(() => {
      // 1. Drop the import data
      const { [importId]: _, ...remainingImports } =
        loadedPlugin.pluginData.imports;
      loadedPlugin.pluginData.imports = remainingImports;

      // 2. Strip slideOrder
      loadedPlugin.pluginData.slideOrder = newSlideOrder;

      // 3. Update renderer state
      const rendererMap = getRendererData?.() ?? {};
      for (const rendererData of Object.values(rendererMap)) {
        const displayModes = rendererData.get("displayModes");
        if (displayModes && displayModes.has(importId)) {
          displayModes.delete(importId);
        }

        const currentIdx = rendererData.get("currentSlideIndex");
        if (currentIdx === null || currentIdx === undefined) continue;

        const oldRef = oldSlideOrder[currentIdx];
        const newIdx =
          oldRef !== undefined ? newSlideOrder.indexOf(oldRef) : -1;

        if (newIdx === -1) {
          rendererData.set("currentSlideIndex", null);
          rendererData.set("currentClickCount", null);
        } else {
          rendererData.set("currentSlideIndex", newIdx);
        }
      }
    });
  };
