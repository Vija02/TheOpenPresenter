import { ObjectToTypedMap, Plugin } from "@repo/base-plugin/server";
import { logger } from "@repo/observability";
import { typeidUnboxed } from "typeid-js";
import * as Y from "yjs";

import {
  GoogleSlidesImportData,
  ImportData,
  ImportType,
  PdfImportData,
  PluginBaseData,
  PptImportData,
} from "../types";

/**
 * Legacy plugin base data format (v1)
 */
interface LegacyPluginBaseData {
  fetchId: string | null;
  type?: ImportType;
  presentationId: string;
  slideClickCounts: number[];
  thumbnailLinks: string[];
  html?: string;
  _isFetching?: boolean;
}

/**
 * Check if the data is in legacy (v1) format.
 * Legacy format has presentation data at the root level instead of in imports.
 */
function isLegacyPluginData(rawData: Y.Map<any>): boolean {
  // Legacy format has these properties at the root level
  return (
    rawData.has("presentationId") ||
    (rawData.has("fetchId") && !rawData.has("imports")) ||
    (rawData.has("thumbnailLinks") && !rawData.has("imports"))
  );
}

/**
 * Convert legacy data to new PluginBaseData format (pure data, not Yjs)
 */
function convertLegacyToNewFormat(
  legacy: LegacyPluginBaseData,
): PluginBaseData {
  // If there's no data, return empty state
  if (
    !legacy.fetchId &&
    (!legacy.thumbnailLinks || legacy.thumbnailLinks.length === 0)
  ) {
    return {
      imports: {},
      slideOrder: [],
    };
  }

  const importId = typeidUnboxed("import");
  const importType = legacy.type ?? "googleslides";

  // Generate slideIds based on index (for legacy data we don't have stable IDs)
  const slideIds = (legacy.thumbnailLinks ?? []).map((_, i) => String(i));

  // Create the import data based on type
  let importData: ImportData;

  if (importType === "googleslides") {
    importData = {
      importId,
      type: "googleslides",
      fetchId: legacy.fetchId ?? typeidUnboxed("fetch"),
      thumbnailLinks: legacy.thumbnailLinks ?? [],
      slideClickCounts: legacy.slideClickCounts ?? [],
      slideIds,
      presentationId: legacy.presentationId ?? "",
      html: legacy.html ?? "",
    } satisfies GoogleSlidesImportData;
  } else if (importType === "pdf") {
    importData = {
      importId,
      type: "pdf",
      fetchId: legacy.fetchId ?? typeidUnboxed("fetch"),
      thumbnailLinks: legacy.thumbnailLinks ?? [],
      slideClickCounts: legacy.slideClickCounts ?? [],
      slideIds,
    } satisfies PdfImportData;
  } else {
    importData = {
      importId,
      type: "ppt",
      fetchId: legacy.fetchId ?? typeidUnboxed("fetch"),
      thumbnailLinks: legacy.thumbnailLinks ?? [],
      slideClickCounts: legacy.slideClickCounts ?? [],
      slideIds,
    } satisfies PptImportData;
  }

  // slideOrder uses index-based refs ("importId:slideIndex").
  const slideOrder = slideIds.map((_, i) => `${importId}:${i}`);

  return {
    imports: {
      [importId]: importData,
    },
    slideOrder,
  };
}

/**
 * Migrates plugin data from v1 (legacy) format to v2 format.
 *
 * V1 format: Single presentation with data at root level
 *   - fetchId, presentationId, thumbnailLinks, slideClickCounts, html, type
 *
 * V2 format: Multiple imports with slideOrder
 *   - imports: Record<importId, ImportData>
 *   - slideOrder: string[] (references in "importId:slideIndex" format)
 */
export const migratePluginDataV1ToV2 = (
  pluginInfo: ObjectToTypedMap<Plugin<PluginBaseData>>,
): boolean => {
  const pluginData = pluginInfo.get("pluginData");
  if (!pluginData) {
    return false;
  }

  const rawPluginData = pluginData as Y.Map<any>;

  // Check if migration is needed
  if (!isLegacyPluginData(rawPluginData)) {
    return false;
  }

  logger.info("Migrating google-slides plugin data from v1 to v2 format");

  // Extract legacy data
  const legacyData: LegacyPluginBaseData = {
    fetchId: rawPluginData.get("fetchId") ?? null,
    type: rawPluginData.get("type"),
    presentationId: rawPluginData.get("presentationId") ?? "",
    slideClickCounts:
      rawPluginData.get("slideClickCounts")?.toJSON?.() ??
      rawPluginData.get("slideClickCounts") ??
      [],
    thumbnailLinks:
      rawPluginData.get("thumbnailLinks")?.toJSON?.() ??
      rawPluginData.get("thumbnailLinks") ??
      [],
    html: rawPluginData.get("html"),
    _isFetching: rawPluginData.get("_isFetching"),
  };

  // Convert to new format
  const newData = convertLegacyToNewFormat(legacyData);

  // Clear old fields
  const oldFields = [
    "fetchId",
    "presentationId",
    "slideClickCounts",
    "thumbnailLinks",
    "html",
    "type",
    "_isFetching",
  ];
  for (const field of oldFields) {
    if (rawPluginData.has(field)) {
      rawPluginData.delete(field);
    }
  }

  // Set new structure
  const importsMap = new Y.Map();
  for (const [importId, importData] of Object.entries(newData.imports)) {
    const importMap = new Y.Map();
    for (const [key, value] of Object.entries(importData)) {
      if (Array.isArray(value)) {
        const arr = new Y.Array();
        arr.push(value);
        importMap.set(key, arr);
      } else {
        importMap.set(key, value);
      }
    }
    importsMap.set(importId, importMap);
  }
  rawPluginData.set("imports", importsMap);

  const slideOrderArray = new Y.Array<string>();
  slideOrderArray.push(newData.slideOrder);
  rawPluginData.set("slideOrder", slideOrderArray);

  logger.info(
    {
      importCount: Object.keys(newData.imports).length,
      slideCount: newData.slideOrder.length,
    },
    "Plugin data migration v1->v2 complete",
  );

  return true;
};
