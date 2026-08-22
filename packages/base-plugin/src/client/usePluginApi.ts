import { useContext } from "react";

import { PluginAPIContext } from "./PluginAPIProvider";
import { initPluginApi } from "./initPluginApi";

// Generic plugin API hook
export function usePluginAPI<
  PluginSceneDataType extends object = any,
  PluginRendererDataType extends object = any,
>() {
  return useContext(PluginAPIContext).pluginAPI as ReturnType<
    typeof initPluginApi<PluginSceneDataType, PluginRendererDataType>
  >;
}
