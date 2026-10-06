import {
  ObjectToTypedMap,
  Plugin,
  RegisterOnRendererDataCreated,
  RegisterOnRendererDataLoaded,
  ServerPluginApi,
  TRPCObject,
  YjsWatcher,
} from "@repo/base-plugin/server";
import { TypedArray } from "@repo/lib";
import { createVideoPlaybackState } from "@repo/video";
import getYouTubeID from "get-youtube-id";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import * as Y from "yjs";
import { Innertube, UniversalCache } from "youtubei.js";
import type { YTNodes } from "youtubei.js";
import z from "zod";

import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";
import { PluginBaseData, PluginRendererData } from "./types";

export const init = (serverPluginApi: ServerPluginApi) => {
  serverPluginApi.registerCSPDirective(pluginName, {
    "script-src": ["https://www.youtube.com"],
    "frame-src": ["https://www.youtube.com"],
  });
  serverPluginApi.registerTrpcAppRouter(getAppRouter);
  serverPluginApi.onPluginDataCreated(pluginName, onPluginDataCreated);
  serverPluginApi.onPluginDataLoaded(pluginName, onPluginDataLoaded);
  serverPluginApi.onRendererDataCreated(pluginName, onRendererDataCreated);
  serverPluginApi.onRendererDataLoaded(pluginName, onRendererDataLoaded);
  serverPluginApi.registerSceneCreator(pluginName, {
    title: "Music Player",
    description:
      "Play music from YouTube or a radio station stream in the background",
    categories: ["Audio"],
    icon: "radio",
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

const createTrackStateMap = () => {
  const stateMap = new Y.Map<any>();
  for (const [key, value] of Object.entries(createVideoPlaybackState())) {
    stateMap.set(key, value);
  }
  return stateMap;
};

const onPluginDataCreated = (
  pluginInfo: ObjectToTypedMap<Plugin<PluginBaseData>>,
) => {
  pluginInfo.get("pluginData")?.set("url", "");
  pluginInfo.get("pluginData")?.set("tracks", new Y.Array() as TypedArray<any>);

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
  rendererData.set("activeTrackId", null);
  rendererData.set("trackState", createTrackStateMap() as any);
  rendererData.set("repeatMode", "off");
  rendererData.set("crossfadeSeconds", 0);
  rendererData.set("fadingOutTrack", null);

  return {};
};

const onRendererDataLoaded: RegisterOnRendererDataLoaded<PluginRendererData> = (
  rendererData,
) => {
  // DEBT: Only follows intent, the server cannot tell when a playlist ends
  const updateAudioIsPlaying = () => {
    const trackIsPlaying =
      !!rendererData.get("activeTrackId") &&
      !!rendererData.get("trackState")?.get("isPlaying");

    rendererData.set(
      "__audioIsPlaying",
      !!rendererData.get("isPlaying") || trackIsPlaying,
    );
  };

  const yjsWatcher = new YjsWatcher(rendererData as Y.Map<any>);
  yjsWatcher.watchYjs(
    (x: PluginRendererData) => x.isPlaying,
    updateAudioIsPlaying,
  );
  yjsWatcher.watchYjs(
    (x: PluginRendererData) => x.activeTrackId,
    updateAudioIsPlaying,
  );
  yjsWatcher.watchYjs(
    (x: PluginRendererData) => x.trackState,
    updateAudioIsPlaying,
  );

  updateAudioIsPlaying();

  return {
    dispose: () => {
      yjsWatcher.dispose();
    },
  };
};

// Creating a session is slow, so it is shared across requests
let innertubePromise: Promise<Innertube> | null = null;
const getInnertube = () => {
  if (!innertubePromise) {
    innertubePromise = Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true,
    }).catch((err) => {
      innertubePromise = null;
      throw err;
    });
  }
  return innertubePromise;
};

const getAppRouter = (t: TRPCObject) => {
  return t.router({
    musicPlayer: {
      search: t.procedure
        .input(
          z.object({
            query: z.string(),
          }),
        )
        .query(async (opts) => {
          const yt = await getInnertube();
          const res = await yt.search(opts.input.query, { type: "video" });

          return {
            results: (
              res.results.filter((x) => x.type === "Video") as YTNodes.Video[]
            ).map((x) => ({
              videoId: x.video_id,
              title: x.title.text ?? "",
              author: x.author.name,
              duration: x.duration.seconds,
              durationText: x.duration.text,
              thumbnailUrl: x.thumbnails[x.thumbnails.length - 1]?.url,
            })),
          };
        }),

      youtubeMetadata: t.procedure
        .input(
          z.object({
            url: z.string(),
          }),
        )
        .mutation(async (opts) => {
          const youtubeId = getYouTubeID(opts.input.url);
          if (!youtubeId) {
            throw new Error("Invalid YouTube URL");
          }

          const yt = await getInnertube();
          const res = await yt.getBasicInfo(youtubeId);

          return {
            videoId: youtubeId,
            title: res.basic_info.title,
            author: res.basic_info.author,
            duration: res.basic_info.duration,
            thumbnailUrl: res.basic_info.thumbnail?.[0]?.url,
          };
        }),
    },
  });
};

export type AppRouter = ReturnType<typeof getAppRouter>;

export * from "./types";
