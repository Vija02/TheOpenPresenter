import { PluginAPIContext, initPluginApi } from "@repo/base-plugin/client";
import { useContext } from "react";

import { MyWorshipListData, PluginRendererData } from "../src/types";

type InitPluginApiFunc = typeof initPluginApi<
  MyWorshipListData,
  PluginRendererData
>;

export function usePluginAPI() {
  return useContext(PluginAPIContext)
    .pluginAPI as ReturnType<InitPluginApiFunc>;
}
