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

export const init = (
  serverPluginApi: ServerPluginApi<PluginBaseData, PluginRendererData>,
) => {
  serverPluginApi.registerCSPDirective(pluginName, {
    "frame-src": ["https://wall.sli.do"],
  });
  serverPluginApi.registerTrpcAppRouter(getAppRouter);
  serverPluginApi.onPluginDataCreated(pluginName, onPluginDataCreated);
  serverPluginApi.registerSceneCreator(pluginName, {
    title: "Slido",
    description: "Show live Slido polls and Q&A on the screen",
    categories: ["Interaction"],
    icon: "poll",
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
  const pluginData = pluginInfo.get("pluginData");

  pluginData?.set("eventCode", null);
  pluginData?.set("section", null);

  return {};
};

const getAppRouter = (t: TRPCObject) => {
  return t.router({});
};

export type AppRouter = ReturnType<typeof getAppRouter>;

export * from "./slido";
export * from "./types";
