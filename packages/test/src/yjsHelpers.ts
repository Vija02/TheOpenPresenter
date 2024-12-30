import { Document } from "@hocuspocus/server";
import {
  AwarenessUserData,
  Plugin,
  Scene,
  State,
  YState,
  createTraverser,
} from "@repo/base-plugin";
import {
  DisposableDocumentManager,
  ServerPluginApiPrivate,
  YjsState,
} from "@repo/base-plugin/server";
import { typeidUnboxed } from "typeid-js";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import * as awareness from "y-protocols/awareness";
import * as Y from "yjs";

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) =>
    setTimeout(() => {
      resolve();
    }, ms),
  );

export const simulateServer = async (
  init: (serverPluginApi: ServerPluginApiPrivate) => void,
) => {
  const serverPluginApi = new ServerPluginApiPrivate("" as any);
  init(serverPluginApi);

  const yDoc = YjsState.createEmptyState();
  const update = Y.encodeStateAsUpdate(yDoc);

  const document = new Document("");
  Y.applyUpdate(document, update);

  const state = document?.getMap() as YState;
  const t = createTraverser<State>(state);

  YjsState.handleYjsDocumentLoad({
    document,
    documentName: "id",
    state,
    serverPluginApi,
    disposableDocumentManager: new DisposableDocumentManager(),
    organizationId: "orgId",
  });

  return { document, state, t };
};

export const addPlugin = async <
  PluginSceneDataType extends Record<any, any> = any,
  PluginRendererDataType extends Record<any, any> = any,
>(
  yState: YState,
  { pluginName, sceneName = "" }: { pluginName: string; sceneName?: string },
) => {
  const t = createTraverser<State>(yState);

  const sceneId = typeidUnboxed("scene");
  const pluginId = typeidUnboxed("plugin");

  const mainState: State = proxy({} as any);
  const unbind = bind(mainState, yState as any);

  mainState.data[sceneId] = {
    name: sceneName,
    order:
      (Math.max(0, ...Object.values(mainState.data).map((x) => x.order)) ?? 0) +
      1,
    type: "scene",
    children: {
      [pluginId]: {
        plugin: pluginName,
        order: 1,
        pluginData: {},
      },
    },
  } as Scene;

  await wait(0);

  unbind();

  const pluginData = t((x) => (x.data[sceneId] as Scene).children[pluginId]);
  const rendererData = t((x) => x.renderer["1"]?.children[sceneId]![pluginId]);

  const pluginDataValtio = proxy({} as Plugin<PluginSceneDataType>);
  bind(pluginDataValtio, pluginData as any);

  const rendererDataValtio = proxy({} as PluginRendererDataType);
  bind(rendererDataValtio, rendererData as any);

  return {
    sceneId,
    pluginId,
    pluginData,
    rendererData,
    pluginDataValtio,
    rendererDataValtio,
  };
};

let id = 0;

export const simulateUser = (document: Document) => {
  const clientDoc = new Y.Doc();
  clientDoc.clientID = id++;

  const aw = new awareness.Awareness(clientDoc);

  const setState = (data: AwarenessUserData | null) => {
    aw.setLocalStateField("user", data);
  };

  aw.on("update", ({ added, updated, removed }: any) => {
    const enc = awareness.encodeAwarenessUpdate(
      aw,
      added.concat(updated).concat(removed),
    );
    awareness.applyAwarenessUpdate(document.awareness, enc, "custom");
  });

  return { setState };
};
