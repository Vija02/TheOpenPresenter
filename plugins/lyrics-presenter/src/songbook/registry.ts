import { Plugin, PluginContext } from "@repo/base-plugin/server";

import { PluginBaseData } from "../types";

// ---------------------------------------------------------------------------
// Loaded-plugin registry
//
// Lifecycle hooks don't get per-request context, so we track every open plugin
// doc here (keyed by pluginId). tRPC procedures use it to resolve the
// organization for a request; the songbook listener uses it to find open docs
// that need refreshing when a linked entry changes elsewhere.
// ---------------------------------------------------------------------------
const loadedContext: Record<string, PluginContext> = {};
const loadedData: Record<string, Plugin<PluginBaseData>> = {};

export const registerLoadedPlugin = (
  context: PluginContext,
  data: Plugin<PluginBaseData>,
) => {
  loadedContext[context.pluginId] = context;
  loadedData[context.pluginId] = data;
};

export const unregisterLoadedPlugin = (pluginId: string) => {
  delete loadedContext[pluginId];
  delete loadedData[pluginId];
};

export const resolveContext = (pluginId: string): PluginContext => {
  const context = loadedContext[pluginId];
  if (!context) {
    throw new Error(
      `Plugin instance ${pluginId} is not loaded; cannot resolve organization.`,
    );
  }
  return context;
};

// Every currently-open plugin doc, paired with its context.
export const getLoadedDocs = (): {
  context: PluginContext;
  data: Plugin<PluginBaseData>;
}[] =>
  Object.keys(loadedContext)
    .map((pluginId) => ({
      context: loadedContext[pluginId]!,
      data: loadedData[pluginId]!,
    }))
    .filter((entry) => !!entry.context && !!entry.data);
