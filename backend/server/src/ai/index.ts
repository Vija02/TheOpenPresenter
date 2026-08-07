import { ServerPluginApiPrivate } from "@repo/base-plugin/server";

import { layoutCapability } from "./layoutCapability";

// Built in capabilities of the platform
export const registerBuiltInAiCapabilities = (
  serverPluginApi: ServerPluginApiPrivate,
) => {
  for (const capability of [layoutCapability(serverPluginApi)]) {
    if (serverPluginApi.hasAiCapability(capability.id)) continue;
    serverPluginApi.registerAiCapability(capability);
  }
};

export * from "./layoutCapability";
