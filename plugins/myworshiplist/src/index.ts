import {
  ObjectToTypedMap,
  Plugin,
  ServerPluginApi,
} from "@repo/base-plugin/server";
import { initTRPC } from "@trpc/server";
import axios from "axios";
import { proxy, subscribe } from "valtio";
import { bind } from "valtio-yjs";
import z from "zod";

import { pluginName, remoteWebComponentTag } from "./consts";
import { getSongData } from "./data";
import { CustomData, MyWorshipListData } from "./types";

export const init = (serverPluginApi: ServerPluginApi) => {
  serverPluginApi.registerTrpcAppRouter(getAppRouter);
  serverPluginApi.onPluginDataCreated(pluginName, onPluginDataCreated);
  serverPluginApi.onPluginDataLoaded(pluginName, onPluginDataLoaded);
  serverPluginApi.registerSceneCreator(pluginName, {
    title: "MyWorshipList",
  });

  serverPluginApi.serveStatic(pluginName, "dist");

  serverPluginApi.loadJsOnRemoteView(pluginName, "myworshiplist-remote.es.js");
  serverPluginApi.registerRemoteViewWebComponent(
    pluginName,
    remoteWebComponentTag,
  );
  serverPluginApi.loadJsOnRendererView(
    pluginName,
    "myworshiplist-renderer.es.js",
  );
  serverPluginApi.registerRendererViewWebComponent(
    pluginName,
    remoteWebComponentTag,
  );
};

const onPluginDataCreated = (pluginInfo: ObjectToTypedMap<Plugin>) => {
  pluginInfo.get("pluginData")?.set("type", "unselected");

  return {};
};

const onPluginDataLoaded = (pluginInfo: ObjectToTypedMap<Plugin>) => {
  const data = proxy(pluginInfo.toJSON() as Plugin<MyWorshipListData>);
  const unbind = bind(data, pluginInfo as any);

  const unsubscribe = subscribe(data.pluginData, async () => {
    if (data.pluginData.type === "custom") {
      const cachedIds = data.pluginData.songCache.map((x) => x.id);
      const noDuplicateSongIds = Array.from(data.pluginData.songIds);

      if (cachedIds.length < noDuplicateSongIds.length) {
        const missingCaches = noDuplicateSongIds.filter(
          (songId) => !cachedIds.includes(songId),
        );

        for (const songId of missingCaches) {
          const songData = await getSongData(songId);

          (data.pluginData as CustomData).songCache.push(songData);
        }
      }
    }
  });

  return {
    dispose: () => {
      unbind();
      unsubscribe();
    },
  };
};

const getAppRouter = (t: ReturnType<typeof initTRPC.create>) => {
  return t.router({
    myworshiplist: {
      search: t.procedure
        .input(
          z.object({
            title: z.string(),
          }),
        )
        .query(async (opts) => {
          const res = await axios("https://myworshiplist.com/api/songs");
          return {
            data: res.data.data,
          };
        }),
    },
  });
};

export type AppRouter = ReturnType<typeof getAppRouter>;

export * from "./types";
