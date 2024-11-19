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
import { convertMWLData } from "./importer/myworshiplist";
import {
  MyWorshipListImportedData,
  PluginBaseData,
  PluginRendererData,
} from "./types";

export const init = (serverPluginApi: ServerPluginApi) => {
  serverPluginApi.registerTrpcAppRouter(getAppRouter);
  serverPluginApi.onPluginDataCreated(pluginName, onPluginDataCreated);
  serverPluginApi.onPluginDataLoaded(pluginName, onPluginDataLoaded);
  serverPluginApi.onRendererDataCreated(pluginName, onRendererDataCreated);
  serverPluginApi.registerSceneCreator(pluginName, {
    title: "Lyrics Presenter",
    description: "Display song lyrics to the screen",
    categories: ["Display"],
    isStarred: true,
  });

  serverPluginApi.serveStatic(pluginName, "out");

  serverPluginApi.loadJsOnRemoteView(pluginName, `${pluginName}-remote.es.js`);
  serverPluginApi.loadCssOnRemoteView(pluginName, `style.css`);
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
  const data = proxy(pluginInfo.toJSON() as Plugin<PluginBaseData>);
  const unbind = bind(data, pluginInfo as any);

  const handleImportSong = async () => {
    for (const song of data.pluginData.songs) {
      if (!song._imported && !!song.import) {
        const songData: MyWorshipListImportedData = await getSongData(
          song.import.meta.id,
        );

        // Store for cache
        const newContent = convertMWLData(songData.content);
        song.import.importedData = { ...songData, content: newContent };

        // Now we store it into the various fields
        song.title = songData.title;
        song.content = newContent;
        song.author = songData.author;

        song._imported = true;
      }
    }
  };

  // Handle on load
  handleImportSong();

  const yjsWatcher = new YjsWatcher(pluginInfo as Y.Map<any>);
  yjsWatcher.watchYjs(
    (x: Plugin<PluginBaseData>) => x.pluginData.songs,
    handleImportSong,
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
  rendererData.set("currentIndex", null);

  return {};
};

const getAppRouter = (t: TRPCObject) => {
  return t.router({
    lyricsPresenter: {
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
