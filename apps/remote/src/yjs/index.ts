import { HocuspocusProvider } from "@hocuspocus/provider";
import type { State } from "@repo/base-plugin";
import { proxy, useSnapshot } from "valtio";
import { bind } from "valtio-yjs";
import * as Y from "yjs";

// TODO: Everything
export const provider = new HocuspocusProvider({
  url: "ws://localhost:5678/wlink",
  name: "example-document",
});

const ymap = provider.document.getMap();

export const mainState = proxy({} as State);
const unbind = bind(mainState, ymap);

export const getYJSPluginData = (sceneId: string) => {
  return (ymap.get("data") as Y.Map<any>).get(sceneId) as Y.Map<any>;
};

export const useData = () => {
  return useSnapshot(mainState);
};
