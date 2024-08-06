import { getTypedProviderHelperFunctions } from "@repo/base-plugin/client";

import { PluginBaseData } from "../src";

const pluginApi = getTypedProviderHelperFunctions<PluginBaseData>();

export { pluginApi };
