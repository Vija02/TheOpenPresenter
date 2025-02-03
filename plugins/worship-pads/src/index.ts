import {
  ObjectToTypedMap,
  Plugin,
  RegisterOnRendererDataLoaded,
  ServerPluginApi,
  TRPCObject,
  getStaticPath,
} from "@repo/base-plugin/server";
import { TypedArray, YjsWatcher } from "@repo/lib";
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
  serverPluginApi.onRendererDataLoaded(pluginName, onRendererDataLoaded);
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
  pluginInfo.get("pluginData")?.set("files", new Y.Array() as TypedArray<any>);

  const data = proxy(pluginInfo.toJSON() as Plugin<PluginBaseData>);
  const unbind = bind(data, pluginInfo as any);

  setTimeout(() => {
    data.pluginData.files = [
      {
        key: "C",
        url: getStaticPath() + "/worship-pads/karl-verkade-bridge/C_Major.mp3",
      },
      {
        key: "Db",
        url: getStaticPath() + "/worship-pads/karl-verkade-bridge/Db_Major.mp3",
      },
      {
        key: "D",
        url: getStaticPath() + "/worship-pads/karl-verkade-bridge/D_Major.mp3",
      },
      {
        key: "Eb",
        url: getStaticPath() + "/worship-pads/karl-verkade-bridge/Eb_Major.mp3",
      },
      {
        key: "E",
        url: getStaticPath() + "/worship-pads/karl-verkade-bridge/E_Major.mp3",
      },
      {
        key: "F",
        url: getStaticPath() + "/worship-pads/karl-verkade-bridge/F_Major.mp3",
      },
      {
        key: "Gb",
        url: getStaticPath() + "/worship-pads/karl-verkade-bridge/Gb_Major.mp3",
      },
      {
        key: "G",
        url: getStaticPath() + "/worship-pads/karl-verkade-bridge/G_Major.mp3",
      },
      {
        key: "Ab",
        url: getStaticPath() + "/worship-pads/karl-verkade-bridge/Ab_Major.mp3",
      },
      {
        key: "A",
        url: getStaticPath() + "/worship-pads/karl-verkade-bridge/A_Major.mp3",
      },
      {
        key: "Bb",
        url: getStaticPath() + "/worship-pads/karl-verkade-bridge/Bb_Major.mp3",
      },
      {
        key: "B",
        url: getStaticPath() + "/worship-pads/karl-verkade-bridge/B_Major.mp3",
      },
    ];

    // So that the update is flushed before we unbind
    setTimeout(() => {
      unbind();
    });
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
