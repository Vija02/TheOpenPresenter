import {
  ObjectToTypedMap,
  Plugin,
  RegisterOnRendererDataLoaded,
  ServerPluginApi,
  TRPCObject,
} from "@repo/base-plugin/server";
import { TypedArray, TypedMap, YjsWatcher } from "@repo/lib";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import Y from "yjs";
import { Innertube, UniversalCache } from "youtubei.js";
import z from "zod";

import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";
import { PluginBaseData, PluginRendererData } from "./types";

export const init = (serverPluginApi: ServerPluginApi) => {
  serverPluginApi.registerCSPDirective(pluginName, {
    "script-src": [
      "https://www.youtube.com",
      "cdn.jsdelivr.net",
      "cdnjs.cloudflare.com",
      "https://player.vimeo.com",
      "https://fast.wistia.com",
    ],
    "frame-src": ["https://www.youtube.com", "https://player.vimeo.com"],
    // To play HLS or DASH from arbitrary source, we unfortunately need to relax this
    "connect-src": ["*"],
    "media-src": ["blob:"],
  });
  serverPluginApi.registerTrpcAppRouter(getAppRouter);
  serverPluginApi.onPluginDataCreated(pluginName, onPluginDataCreated);
  serverPluginApi.onPluginDataLoaded(pluginName, onPluginDataLoaded);
  serverPluginApi.onRendererDataCreated(pluginName, onRendererDataCreated);
  serverPluginApi.onRendererDataLoaded(pluginName, onRendererDataLoaded);
  serverPluginApi.registerSceneCreator(pluginName, {
    title: "Video Player",
    description:
      "Play videos from sources like YouTube and Vimeo. You can also upload your own video.",
    categories: ["Media"],
  });

  serverPluginApi.serveStatic(pluginName, "out");

  serverPluginApi.loadJsOnRemoteView(pluginName, `${pluginName}-remote.es.js`);
  serverPluginApi.registerRemoteViewWebComponent(
    pluginName,
    remoteWebComponentTag,
  );
  serverPluginApi.loadCssOnRemoteView(pluginName, "style.css");
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
  pluginInfo.get("pluginData")?.set("videos", new Y.Array() as TypedArray<any>);

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

const onRendererDataCreated = (
  rendererData: ObjectToTypedMap<PluginRendererData>,
) => {
  rendererData.set("currentPlayingVideo", null);
  rendererData.set("videoSeeks", new Y.Map<any>() as TypedMap<any>);
  rendererData.set("isPlaying", false);
  rendererData.set("volume", 1);

  return {};
};

const onRendererDataLoaded: RegisterOnRendererDataLoaded<PluginRendererData> = (
  rendererData,
  _context,
  { onSceneVisibilityChange },
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

  // onSceneVisibilityChange((visibility: boolean) => {
  //   if (!visibility) {
  //     // PAUSE
  //     rendererData.set("isPlaying", false);
  //   }
  // });
};

const getAppRouter = (t: TRPCObject) => {
  return t.router({
    videoPlayer: {
      search: t.procedure
        .input(
          z.object({
            title: z.string(),
          }),
        )
        .query(async (opts) => {
          const yt = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true,
          });

          const res = await yt.search(opts.input.title, { type: "video" });

          return {
            results: res.results,
            refinements: res.refinements,
          };
        }),
      searchSuggestion: t.procedure
        .input(
          z.object({
            title: z.string(),
          }),
        )
        .query(async (opts) => {
          const yt = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true,
          });

          const res = await yt.getSearchSuggestions(opts.input.title);

          return {
            results: res,
          };
        }),
    },
  });
};

export type AppRouter = ReturnType<typeof getAppRouter>;

export * from "./types";
