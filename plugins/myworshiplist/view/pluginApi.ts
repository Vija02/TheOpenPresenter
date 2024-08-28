import { initPluginApi } from "@repo/base-plugin/client";

import { MyWorshipListData, PluginRendererData } from "../src/types";

type InitPluginApiFunc = typeof initPluginApi<
  MyWorshipListData,
  PluginRendererData
>;

let pluginApi: ReturnType<InitPluginApiFunc>;

function init(...params: Parameters<InitPluginApiFunc>) {
  pluginApi = initPluginApi(...params);
}

export { pluginApi, init };
