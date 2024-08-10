import { getTypedProviderHelperFunctions } from "@repo/base-plugin/client";

import { PluginBaseData, RendererBaseData } from "../src";

const pluginApi = getTypedProviderHelperFunctions<
  PluginBaseData,
  RendererBaseData
>();

export { pluginApi };
