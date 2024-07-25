import { HocuspocusProvider } from "@hocuspocus/provider";
import type { ObjectToTypedMap, Scene, State, YState } from "@repo/base-plugin";
import { proxy, useSnapshot } from "valtio";
import { bind } from "valtio-yjs";

// TODO: Everything
export const provider = new HocuspocusProvider({
  url: "ws://localhost:5678/wlink",
  name: "example-document",
});

const ymap = provider.document.getMap() as YState;

export const mainState = proxy({} as State);
const unbind = bind(mainState, ymap as any);

export const getYJSPluginData = (sceneId: string, pluginId: string) => {
  return (ymap.get("data")?.get(sceneId) as ObjectToTypedMap<Scene>)
    ?.get("children")
    ?.get(pluginId);
};

export const useData = () => {
  return useSnapshot(mainState);
};
