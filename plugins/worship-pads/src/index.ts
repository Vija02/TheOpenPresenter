import {
  ObjectToTypedMap,
  Plugin,
  ServerPluginApi,
  TRPCObject,
} from "@repo/base-plugin/server";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";

import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";
import { PluginBaseData } from "./types";

export const init = (serverPluginApi: ServerPluginApi) => {
  serverPluginApi.registerTrpcAppRouter(getAppRouter);
  serverPluginApi.onPluginDataCreated(pluginName, onPluginDataCreated);
  serverPluginApi.onPluginDataLoaded(pluginName, onPluginDataLoaded);
  serverPluginApi.registerSceneCreator(pluginName, {
    title: "Worship Pads",
    description: "Play an ambient pad to back your worship session",
    categories: ["Audio"],
  });

  serverPluginApi.serveStatic(pluginName, "out");

  serverPluginApi.loadJsOnRemoteView(pluginName, `${pluginName}-remote.es.js`);
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
  const data = proxy(pluginInfo.toJSON() as Plugin<PluginBaseData>);
  const unbind = bind(data, pluginInfo as any);

  data.pluginData.files = [
    {
      key: "C",
      url: "https://raw.githubusercontent.com/Vija02/theopenpresenter-static/refs/heads/main/worship-pads/karl-verkade-bridge/C_Major.mp3",
    },
    {
      key: "Db",
      url: "https://raw.githubusercontent.com/Vija02/theopenpresenter-static/refs/heads/main/worship-pads/karl-verkade-bridge/Db_Major.mp3",
    },
    {
      key: "D",
      url: "https://raw.githubusercontent.com/Vija02/theopenpresenter-static/refs/heads/main/worship-pads/karl-verkade-bridge/D_Major.mp3",
    },
    {
      key: "Eb",
      url: "https://raw.githubusercontent.com/Vija02/theopenpresenter-static/refs/heads/main/worship-pads/karl-verkade-bridge/Eb_Major.mp3",
    },
    {
      key: "E",
      url: "https://raw.githubusercontent.com/Vija02/theopenpresenter-static/refs/heads/main/worship-pads/karl-verkade-bridge/E_Major.mp3",
    },
    {
      key: "F",
      url: "https://raw.githubusercontent.com/Vija02/theopenpresenter-static/refs/heads/main/worship-pads/karl-verkade-bridge/F_Major.mp3",
    },
    {
      key: "Gb",
      url: "https://raw.githubusercontent.com/Vija02/theopenpresenter-static/refs/heads/main/worship-pads/karl-verkade-bridge/Gb_Major.mp3",
    },
    {
      key: "G",
      url: "https://raw.githubusercontent.com/Vija02/theopenpresenter-static/refs/heads/main/worship-pads/karl-verkade-bridge/G_Major.mp3",
    },
    {
      key: "Ab",
      url: "https://raw.githubusercontent.com/Vija02/theopenpresenter-static/refs/heads/main/worship-pads/karl-verkade-bridge/Ab_Major.mp3",
    },
    {
      key: "A",
      url: "https://raw.githubusercontent.com/Vija02/theopenpresenter-static/refs/heads/main/worship-pads/karl-verkade-bridge/A_Major.mp3",
    },
    {
      key: "Bb",
      url: "https://raw.githubusercontent.com/Vija02/theopenpresenter-static/refs/heads/main/worship-pads/karl-verkade-bridge/Bb_Major.mp3",
    },
    {
      key: "B",
      url: "https://raw.githubusercontent.com/Vija02/theopenpresenter-static/refs/heads/main/worship-pads/karl-verkade-bridge/B_Major.mp3",
    },
  ];

  // So that the update is flushed before we unbind
  setTimeout(() => {
    unbind();
  });

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

const getAppRouter = (t: TRPCObject) => {
  return t.router({});
};

export type AppRouter = ReturnType<typeof getAppRouter>;

export * from "./types";
