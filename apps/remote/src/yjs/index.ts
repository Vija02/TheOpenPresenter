import { HocuspocusProvider } from "@hocuspocus/provider";
import type { ObjectToTypedMap, Scene, State, YState } from "@repo/base-plugin";
import { proxy, useSnapshot } from "valtio";
import { bind } from "valtio-yjs";

import { getRootURL } from "../appData";

// TODO: Everything
export const provider = new HocuspocusProvider({
  url: (getRootURL() + "/wlink").replace(/^http/, "ws"),
  name: "example-document",
});

const ymap = provider.document.getMap() as YState;

export const mainState = proxy({} as State);
const unbind = bind(mainState, ymap as any);

export const getYJSPluginSceneData = (sceneId: string, pluginId: string) => {
  return (ymap.get("data")?.get(sceneId) as ObjectToTypedMap<Scene>)
    ?.get("children")
    ?.get(pluginId);
};
export const getYJSPluginRendererData = (sceneId: string, pluginId: string) => {
  const pluginRenderData = ymap
    .get("renderer")
    ?.get("1")
    ?.get("children")
    ?.get(sceneId)
    ?.get(pluginId);
  return pluginRenderData;
};
export const getYJSPluginRenderer = () => {
  return ymap.get("renderer")?.get("1");
};

export const useData = () => {
  return useSnapshot(mainState);
};
