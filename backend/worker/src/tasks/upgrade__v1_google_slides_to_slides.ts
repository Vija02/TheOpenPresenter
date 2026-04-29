import type { YState } from "@repo/base-plugin";
import { Task } from "graphile-worker";
import { typeidUnboxed } from "typeid-js";
import * as Y from "yjs";

const OLD_PLUGIN_NAME = "google-slides";
const NEW_PLUGIN_NAME = "slides";

type ImportType = "googleslides" | "pdf" | "ppt";

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
 * Detect the legacy v1 format. The old format stored the presentation data at
 * the root of `pluginData`; the new format keeps everything under `imports`.
 */
function isLegacyPluginData(rawData: Y.Map<any>): boolean {
  return (
    rawData.has("presentationId") ||
    (rawData.has("fetchId") && !rawData.has("imports")) ||
    (rawData.has("thumbnailLinks") && !rawData.has("imports"))
  );
}

/**
 * Convert the extracted legacy data into the new (v2) shape as plain JS data.
 */
function convertLegacyToNewFormat(legacy: LegacyPluginBaseData): {
  imports: Record<string, any>;
  slideOrder: string[];
} {
  // Empty plugin -> empty new structure.
  if (
    !legacy.fetchId &&
    (!legacy.thumbnailLinks || legacy.thumbnailLinks.length === 0)
  ) {
    return { imports: {}, slideOrder: [] };
  }

  const importId = typeidUnboxed("import");
  const importType: ImportType = legacy.type ?? "googleslides";

  const slideIds = (legacy.thumbnailLinks ?? []).map((_, i) => String(i));

  let importData: Record<string, any>;
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
    };
  } else if (importType === "pdf") {
    importData = {
      importId,
      type: "pdf",
      fetchId: legacy.fetchId ?? typeidUnboxed("fetch"),
      thumbnailLinks: legacy.thumbnailLinks ?? [],
      slideClickCounts: legacy.slideClickCounts ?? [],
      slideIds,
    };
  } else {
    importData = {
      importId,
      type: "ppt",
      fetchId: legacy.fetchId ?? typeidUnboxed("fetch"),
      thumbnailLinks: legacy.thumbnailLinks ?? [],
      slideClickCounts: legacy.slideClickCounts ?? [],
      slideIds,
    };
  }

  const slideOrder = slideIds.map((_, i) => `${importId}:${i}`);

  return {
    imports: { [importId]: importData },
    slideOrder,
  };
}

/**
 * Apply the v1 -> v2 migration on a single plugin's `pluginData` Y.Map.
 * Returns true when the data was mutated.
 */
function migratePluginDataV1ToV2(rawPluginData: Y.Map<any>): boolean {
  if (!isLegacyPluginData(rawPluginData)) {
    return false;
  }

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

  const newData = convertLegacyToNewFormat(legacyData);

  // Drop the legacy fields.
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

  // Re-build the new structure as Y.Map / Y.Array so collaborative editing
  // continues to work.
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

  return true;
}

const task: Task = async (_, { withPgClient }) => {
  const { rows: projects } = await withPgClient((pgClient) =>
    pgClient.query(
      `
        select * from app_public.projects
      `,
      [],
    ),
  );

  for (const project of projects) {
    try {
      const document = project.document;
      const ydoc = new Y.Doc();

      Y.applyUpdate(ydoc, document);

      const state = ydoc?.getMap() as YState;
      const dataMap = state.get("data") as Y.Map<any> | undefined;

      if (!dataMap) {
        continue;
      }

      let mutated = false;

      ydoc.transact(() => {
        for (const sceneValue of dataMap.values()) {
          if (!(sceneValue instanceof Y.Map)) continue;
          if (sceneValue.get("type") !== "scene") continue;

          const children = sceneValue.get("children") as
            | Y.Map<any>
            | undefined;
          if (!children) continue;

          for (const pluginValue of children.values()) {
            if (!(pluginValue instanceof Y.Map)) continue;

            const pluginName = pluginValue.get("plugin");
            if (
              pluginName !== OLD_PLUGIN_NAME &&
              pluginName !== NEW_PLUGIN_NAME
            ) {
              continue;
            }

            // 1. Migrate v1 -> v2 data shape if needed.
            try {
              const pluginData = pluginValue.get("pluginData") as
                | Y.Map<any>
                | undefined;
              if (pluginData) {
                const didMigrate = migratePluginDataV1ToV2(pluginData);
                if (didMigrate) mutated = true;
              }
            } catch (e) {
              console.error(
                "Slides: Failed to migrate plugin data v1 -> v2",
                e,
              );
            }

            // 2. Rename the plugin from `google-slides` to `slides`.
            try {
              if (pluginName === OLD_PLUGIN_NAME) {
                pluginValue.set("plugin", NEW_PLUGIN_NAME);
                mutated = true;
              }
            } catch (e) {
              console.error("Slides: Failed to rename plugin", e);
            }
          }
        }
      });

      if (!mutated) {
        continue;
      }

      // SAVE TO DB
      try {
        await withPgClient(async (pgClient) => {
          await pgClient.query("SET session_replication_role = replica;");
          await pgClient.query(
            "update app_public.projects set document = $1 where id = $2",
            [Buffer.from(Y.encodeStateAsUpdate(ydoc)), project.id],
          );
          return Promise.resolve();
        });
      } catch (e) {
        console.error("Failed to save the migrated data to the database", e);
      }
    } catch (e) {
      console.error("Failed to migrate project id: " + project.id, e);
    }
  }
};

module.exports = task;
