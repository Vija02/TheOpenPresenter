import {
  AnyAiCapability,
  ServerPluginApiPrivate,
} from "@repo/base-plugin/server";

import { deckLayoutCapability } from "./deckLayoutCapability";
import { layoutCapability } from "./layoutCapability";

// Built in capabilities of the platform
export const registerBuiltInAiCapabilities = (
  serverPluginApi: ServerPluginApiPrivate,
) => {
  const capabilities: AnyAiCapability[] = [
    layoutCapability(serverPluginApi),
    deckLayoutCapability(serverPluginApi),
  ];
  for (const capability of capabilities) {
    if (serverPluginApi.hasAiCapability(capability.id)) continue;
    serverPluginApi.registerAiCapability(capability);
  }
};

export * from "./deckLayoutCapability";
export * from "./layoutCapability";
