import type {
  ObjectToTypedMap,
  Plugin,
  PluginContext,
} from "@repo/base-plugin/server";

import type { PluginBaseData, PluginRendererData } from "./types";

export const loadedPlugins: Record<string, Plugin<PluginBaseData>> = {};
export const loadedContext: Record<string, PluginContext> = {};
export const loadedYjsData: Record<
  string,
  ObjectToTypedMap<Plugin<PluginBaseData>>
> = {};
export const loadedRendererDataGetter: Record<
  string,
  () => Record<string, ObjectToTypedMap<PluginRendererData>>
> = {};
