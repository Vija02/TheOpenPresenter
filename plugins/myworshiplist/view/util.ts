import { getTypedProviderHelperFunctions } from "@repo/base-plugin/client";

import { CustomData } from "../src";

const { usePluginDataContext, useSceneData, useValtioSceneData } =
  getTypedProviderHelperFunctions<CustomData>();

export { usePluginDataContext, useSceneData, useValtioSceneData };
