import type { YState } from "@repo/base-plugin";
import * as Y from "yjs";

import type { LegacyPluginData } from "./lyricsLayoutUpgrade";

const PLUGIN_NAME = "lyrics-presenter";

export const toYjs = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    const array = new Y.Array();
    array.push(value.map(toYjs));
    return array;
  }
  if (value !== null && typeof value === "object") {
    const map = new Y.Map();
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) map.set(key, toYjs(entry));
    }
    return map;
  }
  return value;
};

export type LyricsScene = { pluginData: Y.Map<any>; legacy: LegacyPluginData };

export const lyricsScenes = (ydoc: Y.Doc): LyricsScene[] => {
  const state = ydoc.getMap() as YState;
  const dataMap = state.get("data") as Y.Map<any> | undefined;
  const scenes: LyricsScene[] = [];

  for (const sceneValue of dataMap?.values() ?? []) {
    if (!(sceneValue instanceof Y.Map)) continue;
    if (sceneValue.get("type") !== "scene") continue;

    const children = sceneValue.get("children") as Y.Map<any> | undefined;
    for (const pluginValue of children?.values() ?? []) {
      if (!(pluginValue instanceof Y.Map)) continue;
      if (pluginValue.get("plugin") !== PLUGIN_NAME) continue;

      const pluginData = pluginValue.get("pluginData");
      if (!(pluginData instanceof Y.Map)) continue;
      scenes.push({
        pluginData,
        legacy: pluginData.toJSON() as LegacyPluginData,
      });
    }
  }
  return scenes;
};
