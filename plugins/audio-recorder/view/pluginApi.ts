import { initPluginApi } from "@repo/base-plugin/client";

import { PluginBaseData, PluginRendererData } from "../src/types";

type InitPluginApiFunc = typeof initPluginApi<
  PluginBaseData,
  PluginRendererData
>;

let pluginApi: ReturnType<InitPluginApiFunc>;

function init(...params: Parameters<InitPluginApiFunc>) {
  pluginApi = initPluginApi(...params);
}

export { pluginApi, init };
