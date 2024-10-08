import {
  ObjectToTypedMap,
  Plugin,
  ServerPluginApi,
  TRPCObject,
  YjsWatcher,
} from "@repo/base-plugin/server";
import axios from "axios";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import Y from "yjs";
import z from "zod";

import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";
import { getSongData } from "./data";
import { MyWorshipListData, PluginRendererData, Song } from "./types";

export const init = (serverPluginApi: ServerPluginApi) => {
  serverPluginApi.registerTrpcAppRouter(getAppRouter);
  serverPluginApi.onPluginDataCreated(pluginName, onPluginDataCreated);
  serverPluginApi.onPluginDataLoaded(pluginName, onPluginDataLoaded);
  serverPluginApi.onRendererDataCreated(pluginName, onRendererDataCreated);
  serverPluginApi.registerSceneCreator(pluginName, {
    title: "MyWorshipList",
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

const onPluginDataCreated = (pluginInfo: ObjectToTypedMap<Plugin>) => {
  pluginInfo.get("pluginData")?.set("songs", new Y.Array());

  return {};
};

const onPluginDataLoaded = (pluginInfo: ObjectToTypedMap<Plugin>) => {
  const data = proxy(pluginInfo.toJSON() as Plugin<MyWorshipListData>);
  const unbind = bind(data, pluginInfo as any);

  // Migrate from old type
  if (!data.pluginData.songs) {
    data.pluginData.songs = [];

    try {
      const pluginData = data.pluginData as any;

      pluginData.songIds.map((songId: number) => {
        const songCache = pluginData.songCache.find(
          (cache: any) => cache.id === songId,
        );

        pluginData.songs.push({
          id: songId,
          cachedData: songCache,
          setting: { displayType: "sections" },
        } satisfies Song);
      });

      delete pluginData.songIds;
      delete pluginData.songCache;
    } catch (e) {
      console.error("MWL: Failed to migrate to new data version");
    }
  }

  const handleCachedSong = async () => {
    for (const song of data.pluginData.songs) {
      if (!song.cachedData) {
        const songData = await getSongData(song.id);

        song.cachedData = songData;
      }
    }
  };

  // Handle on load
  handleCachedSong();

  const yjsWatcher = new YjsWatcher(pluginInfo as Y.Map<any>);
  yjsWatcher.watchYjs(
    (x: Plugin<MyWorshipListData>) => x.pluginData.songs,
    handleCachedSong,
  );

  return {
    dispose: () => {
      unbind();
      yjsWatcher.dispose();
    },
  };
};

const onRendererDataCreated = (
  rendererData: ObjectToTypedMap<Partial<PluginRendererData>>,
) => {
  rendererData.set("songId", null);
  rendererData.set("heading", null);

  return {};
};

const getAppRouter = (t: TRPCObject) => {
  return t.router({
    myworshiplist: {
      search: t.procedure
        .input(
          z.object({
            title: z.string(),
          }),
        )
        .query(async (opts) => {
          const res = await axios(
            "https://myworshiplist.com/api/songs?search=" + opts.input.title,
          );
          return {
            data: res.data.data,
          };
        }),
      playlist: t.procedure.query(async () => {
        const res = await axios("https://myworshiplist.com/api/songlists");
        return {
          data: res.data.data,
        };
      }),
    },
  });
};

export type AppRouter = ReturnType<typeof getAppRouter>;

export * from "./types";
