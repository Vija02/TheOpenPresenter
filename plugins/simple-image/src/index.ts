import {
  ObjectToTypedMap,
  Plugin,
  ServerPluginApi,
} from "@repo/base-plugin/server";
import { initTRPC } from "@trpc/server";
import Y from "yjs";

import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";

export const init = (serverPluginApi: ServerPluginApi) => {
  serverPluginApi.registerTrpcAppRouter(getAppRouter);
  serverPluginApi.onPluginDataCreated(pluginName, onPluginDataCreated);
  serverPluginApi.registerSceneCreator(pluginName, {
    title: "Simple Image",
  });

  serverPluginApi.serveStatic(pluginName, "dist");

  serverPluginApi.loadJsOnRemoteView(pluginName, "simple-image-remote.es.js");
  serverPluginApi.loadCssOnRemoteView(pluginName, "style.css");
  serverPluginApi.registerRemoteViewWebComponent(
    pluginName,
    remoteWebComponentTag,
  );
  serverPluginApi.loadJsOnRendererView(
    pluginName,
    "simple-image-renderer.es.js",
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

const getAppRouter = (t: ReturnType<typeof initTRPC.create>) => {
  return t.router({});
};

export type AppRouter = ReturnType<typeof getAppRouter>;

export * from "./types";
