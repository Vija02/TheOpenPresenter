import { PluginContext } from "@repo/base-plugin/server";

const loadedContext: Record<string, PluginContext> = {};

export const registerLoadedPlugin = (context: PluginContext) => {
  loadedContext[context.pluginId] = context;
};

export const unregisterLoadedPlugin = (pluginId: string) => {
  delete loadedContext[pluginId];
};

export const resolveContext = (pluginId: string): PluginContext => {
  const context = loadedContext[pluginId];
  if (!context) {
    throw new Error(
      `Bible plugin instance ${pluginId} is not loaded; cannot resolve organization.`,
    );
  }
  return context;
};
