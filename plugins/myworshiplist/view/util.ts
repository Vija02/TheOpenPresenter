import { getTypedProviderHelperFunctions } from "@repo/base-plugin/client";

import { CustomData } from "../src";

const pluginApi = getTypedProviderHelperFunctions<CustomData>();

export { pluginApi };
