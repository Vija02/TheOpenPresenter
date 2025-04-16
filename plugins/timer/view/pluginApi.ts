import { PluginAPIContext, initPluginApi } from "@repo/base-plugin/client";
import { useContext } from "react";

import { PluginBaseData, PluginRendererData } from "../src/types";

type InitPluginApiFunc = typeof initPluginApi<
  PluginBaseData,
  PluginRendererData
>;

export function usePluginAPI() {
  return useContext(PluginAPIContext)
    .pluginAPI as ReturnType<InitPluginApiFunc>;
}
