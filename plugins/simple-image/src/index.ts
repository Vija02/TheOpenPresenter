import {
  ObjectToTypedMap,
  Plugin,
  RegisterOnRendererDataLoaded,
  ServerPluginApi,
  TRPCObject,
} from "@repo/base-plugin/server";
import * as Y from "yjs";

import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";
import { migrateRendererDataV1ToV2 } from "./migrate/v1";
import { PluginBaseData, PluginRendererData } from "./types";

export const init = (
  serverPluginApi: ServerPluginApi<PluginBaseData, PluginRendererData>,
) => {
  serverPluginApi.registerTrpcAppRouter(getAppRouter);
  serverPluginApi.onPluginDataCreated(pluginName, onPluginDataCreated);
  serverPluginApi.onRendererDataCreated(pluginName, onRendererDataCreated);
  serverPluginApi.onRendererDataLoaded(pluginName, onRendererDataLoaded);
  serverPluginApi.registerSceneCreator(pluginName, {
    title: "Simple Image",
    description: "Upload and display an image to the screen",
    categories: ["Media"],
  });

  serverPluginApi.serveStatic(pluginName, "out");

  serverPluginApi.loadJsOnRemoteView(pluginName, `${pluginName}-remote.es.js`);
  serverPluginApi.loadCssOnRemoteView(pluginName, "RemoteEntry.css");
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

const onPluginDataCreated = (pluginInfo: ObjectToTypedMap<Plugin>) => {
  pluginInfo.get("pluginData")?.set("images", new Y.Array());

  return {};
};

const onRendererDataCreated = (
  rendererData: ObjectToTypedMap<PluginRendererData>,
) => {
  rendererData.set("imgIndex", 0);
  rendererData.set("lastClickTimestamp", null);
  rendererData.set("autoplay", null);

  return {};
};

const onRendererDataLoaded: RegisterOnRendererDataLoaded<PluginRendererData> = (
  rendererData,
) => {
  migrateRendererDataV1ToV2(rendererData);

  return {};
};

const getAppRouter = (t: TRPCObject) => {
  return t.router({});
};

export type AppRouter = ReturnType<typeof getAppRouter>;

export * from "./types";
