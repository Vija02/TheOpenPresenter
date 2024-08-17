import { getTypedProviderHelperFunctions } from "@repo/base-plugin/client";

import { CustomTypeData } from "../src";

const pluginApi = getTypedProviderHelperFunctions<CustomTypeData>();

export { pluginApi };
