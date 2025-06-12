import {
  ObjectToTypedMap,
  Plugin,
  ServerPluginApi,
  TRPCObject,
} from "@repo/base-plugin/server";

import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";
import { PluginBaseData, PluginRendererData } from "./types";

export const init = (serverPluginApi: ServerPluginApi) => {
  serverPluginApi.registerTrpcAppRouter(getAppRouter);
  serverPluginApi.onPluginDataCreated(pluginName, onPluginDataCreated);
  serverPluginApi.onRendererDataCreated(pluginName, onRendererDataCreated);
  serverPluginApi.registerSceneCreator(pluginName, {
    title: "Timer",
    description: "Show a timer on the screen",
    categories: ["Display"],
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
  // 5m timer
  pluginInfo.get("pluginData")?.set("timerDuration", 5 * 60 * 1000);

  return {};
};

const onRendererDataCreated = (
  rendererData: ObjectToTypedMap<Partial<PluginRendererData>>,
) => {
  rendererData.set("isRunning", false);
  rendererData.set("timeStarted", null);

  return {};
};

const getAppRouter = (t: TRPCObject) => {
  return t.router({});
};

export type AppRouter = ReturnType<typeof getAppRouter>;

export * from "./types";
