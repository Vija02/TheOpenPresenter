import { Scene, ServerPluginApi } from "@repo/base-plugin/server";
import { initTRPC } from "@trpc/server";
import { proxy, subscribe } from "valtio";
import { bind } from "valtio-yjs";
import type { Map } from "yjs";
import z from "zod";

import { pluginName, remoteWebComponentTag } from "./consts";
import { CustomData, MyWorshipListData } from "./types";

// TODO: API
const sampleData = [
  {
    id: "1",
    title: "Jesus I need you",
    content: `Hope be my anthem
Lord, when the world has fallen quiet`,
  },
  {
    id: "2",
    title: "One Way",
    content: `I lay my life down at Your feet
Cause You’re the only one I need`,
  },
  {
    id: "3",
    title: "Turn it up",
    content: `You are here as we lift you up
You are riding on our praise`,
  },
  { id: "4", title: "Cornerstone", content: "" },
  { id: "5", title: "10000 Reasons", content: "" },
];

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

  const unsubscribe = subscribe(data.data, () => {
    if (data.data.type === "custom") {
      const cachedIds = data.data.songCache.map((x) => x.id);
      const noDuplicateSongIds = Array.from(data.data.songIds);

      if (cachedIds.length < noDuplicateSongIds.length) {
        const missingCaches = noDuplicateSongIds.filter(
          (songId) => !cachedIds.includes(songId),
        );

        missingCaches.forEach((songId) => {
          const newD = sampleData.find((x) => x.id === songId);

          (data.data as CustomData).songCache.push(newD!);
        });
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
          return {
            data: sampleData,
          };
        }),
    },
  });
};

export type AppRouter = ReturnType<typeof getAppRouter>;

export * from "./types";
