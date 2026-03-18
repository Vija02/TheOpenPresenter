import { initPluginApi } from "@repo/base-plugin/client";
import { PluginAPIContext } from "@repo/base-plugin/client";
import { useContext } from "react";

type InitPluginApiFunc = typeof initPluginApi<any, any>;

export function usePluginAPI() {
  return useContext(PluginAPIContext)
    .pluginAPI as ReturnType<InitPluginApiFunc>;
}
