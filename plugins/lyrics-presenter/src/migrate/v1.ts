import { ObjectToTypedMap, Plugin } from "@repo/base-plugin/server";
import { logger } from "@repo/observability";
import * as Y from "yjs";

import { PluginBaseData } from "../types";

/**
 * Migrates plugin data from v1 format to v2 format.
 * Ensures videoBackgrounds array exists.
 */
export const migratePluginDataV1ToV2 = (
  pluginInfo: ObjectToTypedMap<Plugin<PluginBaseData>>,
): boolean => {
  const pluginData = pluginInfo.get("pluginData");
  if (!pluginData) {
    return false;
  }

  const rawPluginData = pluginData as Y.Map<any>;

  // Check if videoBackgrounds already exists
  if (!rawPluginData.has("videoBackgrounds")) {
    logger.info(
      "Migrating lyrics-presenter plugin data: adding videoBackgrounds array",
    );
    rawPluginData.set("videoBackgrounds", new Y.Array());
    logger.info("Plugin data migration complete");
    return true;
  }

  return false;
};
