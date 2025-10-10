import {
  ObjectToTypedMap,
  Plugin,
  ServerPluginApi,
  TRPCObject,
  YjsWatcher,
} from "@repo/base-plugin/server";
import { logger } from "@repo/observability";
import axios from "axios";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import * as Y from "yjs";
import z from "zod";

import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";
import { getSongData } from "./data";
import { convertMWLData } from "./importer/myworshiplist";
import { getMaxIndex, processSong } from "./songHelpers";
import {
  MyWorshipListImportedData,
  PluginBaseData,
  PluginRendererData,
  Song,
} from "./types";

export const init = (
  serverPluginApi: ServerPluginApi<PluginBaseData, PluginRendererData>,
) => {
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
  serverPluginApi.loadCssOnRemoteView(pluginName, `RemoteEntry.css`);
  serverPluginApi.registerRemoteViewWebComponent(
    pluginName,
    remoteWebComponentTag,
  );
  serverPluginApi.loadJsOnRendererView(
    pluginName,
    `${pluginName}-renderer.es.js`,
  );
  serverPluginApi.loadCssOnRendererView(pluginName, `RendererEntry.css`);
  serverPluginApi.registerRendererViewWebComponent(
    pluginName,
    rendererWebComponentTag,
  );

  serverPluginApi.registerKeyPressHandler(
    pluginName,
    (keyType, { document, pluginData, rendererData }) => {
      const songs: Song[] = pluginData.get("songs")?.toJSON() ?? [];
      const songIds = songs.map((x) => x.id);

      const currentSongId = rendererData.get("songId");
      const currentIndex = rendererData.get("currentIndex");

      // If nothing yet, we can just set it to the first item
      if (currentIndex === null || currentIndex === undefined) {
        if (songIds.length > 0) {
          document.transact(() => {
            rendererData.set("songId", songIds[0]!);
            rendererData.set("currentIndex", 0);
          });
        }
        return;
      }

      const currentSong = songs.find((x) => x.id === currentSongId);
      const currentSongMaxIndex = getMaxIndex(
        processSong(currentSong?.content ?? ""),
      );

      // Then handle next
      if (keyType === "NEXT") {
        const newIndex = (currentIndex ?? 0) + 1;

        // Handle going to next song if at the end
        if (newIndex >= currentSongMaxIndex) {
          const nextSongId =
            songIds[songIds.findIndex((x) => x === currentSongId) + 1];
          if (nextSongId) {
            document.transact(() => {
              rendererData.set("songId", nextSongId);
              rendererData.set("currentIndex", 0);
            });
          }
        } else {
          rendererData.set("currentIndex", newIndex);
        }
      } else {
        // Then handle previous
        const newIndex = (currentIndex ?? 0) - 1;

        // Handle going to previous song if at the beginning
        if (newIndex < 0) {
          const prevSongId =
            songIds[songIds.findIndex((x) => x === currentSongId) - 1];
          if (prevSongId) {
            const prevSongMaxIndex = getMaxIndex(
              processSong(
                songs.find((x) => x.id === prevSongId)?.content ?? "",
              ),
            );
            document.transact(() => {
              rendererData.set("songId", prevSongId);
              rendererData.set("currentIndex", prevSongMaxIndex - 1);
            });
          }
        } else {
          rendererData.set("currentIndex", newIndex);
        }
      }
    },
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
            page: z.number().optional(),
          }),
        )
        .query(async (opts) => {
          try {
            const res = await axios(
              "https://myworshiplist.com/api/songs?search=" +
                opts.input.title +
                (opts.input.page !== null ? `&page=${opts.input.page}` : ""),
            );
            return {
              data: res.data.data,
              totalPage: res.data.meta.last_page,
            };
          } catch (error) {
            logger.error(
              { error, ctx: opts.ctx, input: opts.input },
              "/lyricsPresenter.search: Error",
            );
            throw error;
          }
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
