import {
  ObjectToTypedMap,
  Plugin,
  RegisterOnRendererDataCreated,
  RegisterOnRendererDataLoaded,
  ServerPluginApi,
  TRPCObject,
  YjsWatcher,
} from "@repo/base-plugin/server";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import * as Y from "yjs";

import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";
import { PluginBaseData, PluginRendererData } from "./types";

export const init = (serverPluginApi: ServerPluginApi) => {
  serverPluginApi.registerTrpcAppRouter(getAppRouter);
  serverPluginApi.onPluginDataCreated(pluginName, onPluginDataCreated);
  serverPluginApi.onPluginDataLoaded(pluginName, onPluginDataLoaded);
  serverPluginApi.onRendererDataCreated(pluginName, onRendererDataCreated);
  serverPluginApi.onRendererDataLoaded(pluginName, onRendererDataLoaded);
  serverPluginApi.registerSceneCreator(pluginName, {
    title: "Radio",
    description: "Play a radio station stream in the background",
    categories: ["Audio"],
  });

  serverPluginApi.serveStatic(pluginName, "out");

  serverPluginApi.loadJsOnRemoteView(pluginName, `${pluginName}-remote.es.js`);
  serverPluginApi.loadCssOnRemoteView(pluginName, `RemoteEntry.css`);
  serverPluginApi.registerRemoteViewWebComponent(
    pluginName,
    remoteWebComponentTag,
  );
  serverPluginApi.loadJsOnRendererView(
    pluginName,
    `${pluginName}-renderer.es.js`,
  );
  serverPluginApi.registerRendererViewWebComponent(
    pluginName,
    rendererWebComponentTag,
  );
};

const onPluginDataCreated = (
  pluginInfo: ObjectToTypedMap<Plugin<PluginBaseData>>,
) => {
  pluginInfo.get("pluginData")?.set("url", "");

  return {};
};

const onPluginDataLoaded = (
  pluginInfo: ObjectToTypedMap<Plugin<PluginBaseData>>,
) => {
  const data = proxy(pluginInfo.toJSON() as Plugin<PluginBaseData>);
  const unbind = bind(data, pluginInfo as any);

  return {
    dispose: () => {
      unbind();
    },
  };
};

const onRendererDataCreated: RegisterOnRendererDataCreated<
  PluginRendererData
> = (rendererData) => {
  rendererData.set("url", null);
  rendererData.set("isPlaying", false);
  rendererData.set("volume", 1);

  return {};
};

const onRendererDataLoaded: RegisterOnRendererDataLoaded<PluginRendererData> = (
  rendererData,
) => {
  const yjsWatcher = new YjsWatcher(rendererData as Y.Map<any>);
  yjsWatcher.watchYjs(
    (x: PluginRendererData) => x.isPlaying,
    () => {
      rendererData.set("__audioIsPlaying", rendererData.get("isPlaying"));
    },
  );

  return {
    dispose: () => {
      yjsWatcher.dispose();
    },
  };
};

const getAppRouter = (t: TRPCObject) => {
  return t.router({});
};

export type AppRouter = ReturnType<typeof getAppRouter>;

export * from "./types";
