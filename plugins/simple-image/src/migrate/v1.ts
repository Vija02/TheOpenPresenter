/**
 * Migration from v1 (old format) to v2 (new format)
 *
 * Renderer Data:
 *   Old format: { imgIndex: number }
 *   New format: { imgIndex: number, lastClickTimestamp: number | null, autoplay: AutoplayState | null }
 */
import { ObjectToTypedMap } from "@repo/base-plugin/server";
import { logger } from "@repo/observability";
import * as Y from "yjs";

import { PluginRendererData } from "../types";

/**
 * Migrates renderer data from v1 format to v2 format.
 * Adds lastClickTimestamp and autoplay fields if they don't exist.
 */
export const migrateRendererDataV1ToV2 = (
  rendererData: ObjectToTypedMap<PluginRendererData>,
): boolean => {
  const rawData = rendererData as Y.Map<any>;

  let migrated = false;

  // Add lastClickTimestamp if it doesn't exist
  if (!rawData.has("lastClickTimestamp")) {
    logger.info(
      "Migrating simple-image renderer data: adding lastClickTimestamp field",
    );
    rendererData.set("lastClickTimestamp", null);
    migrated = true;
  }

  // Add autoplay if it doesn't exist
  if (!rawData.has("autoplay")) {
    logger.info("Migrating simple-image renderer data: adding autoplay field");
    rendererData.set("autoplay", null);
    migrated = true;
  }

  if (migrated) {
    logger.info("Simple-image renderer data migration complete");
  }

  return migrated;
};
