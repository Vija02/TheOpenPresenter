import { Scene, ServerPluginApi } from "@repo/base-plugin/server";
import { initTRPC } from "@trpc/server";
import axios from "axios";
import { proxy, subscribe } from "valtio";
import { bind } from "valtio-yjs";
import type { Map } from "yjs";
import z from "zod";

import { pluginName, remoteWebComponentTag } from "./consts";
import { getSongData } from "./data";
import { CustomData, MyWorshipListData } from "./types";

export const init = (serverPluginApi: ServerPluginApi) => {
  serverPluginApi.registerTrpcAppRouter(getAppRouter);
  serverPluginApi.onPluginDataLoaded(pluginName, onPluginDataLoaded);

  serverPluginApi.serveStatic(pluginName, "dist");
  serverPluginApi.loadJsOnRemoteView(pluginName, "myworshiplist-remote.es.js");
  serverPluginApi.registerRemoteViewWebComponent(
    pluginName,
    remoteWebComponentTag,
  );
};

const onPluginDataLoaded = (entryData: Map<any>) => {
  const data = proxy<Scene<MyWorshipListData>>(entryData.toJSON() as any);
  const unbind = bind(data, entryData);

  const unsubscribe = subscribe(data.data, async () => {
    if (data.data.type === "custom") {
      const cachedIds = data.data.songCache.map((x) => x.id);
      const noDuplicateSongIds = Array.from(data.data.songIds);

      if (cachedIds.length < noDuplicateSongIds.length) {
        const missingCaches = noDuplicateSongIds.filter(
          (songId) => !cachedIds.includes(songId),
        );

        for (const songId of missingCaches) {
          const songData = await getSongData(songId);

          (data.data as CustomData).songCache.push(songData);
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
