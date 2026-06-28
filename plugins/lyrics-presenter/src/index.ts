import {
  ObjectToTypedMap,
  Plugin,
  ServerPluginApi,
  TRPCObject,
  YjsWatcher,
} from "@repo/base-plugin/server";
import { OrganizationType } from "@repo/graphql";
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
import { formatLyricsStream } from "./ai/formatLyrics";
import { getSongData } from "./data";
import { convertMWLData } from "./importer/myworshiplist";
import { migratePluginDataV1ToV2 } from "./migrate/v1";
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

  serverPluginApi.registerPrivateRoute(pluginName, "ai/format", (req, res) => {
    if (req.method !== "POST") {
      res.sendStatus(405);
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", async () => {
      let content = "";
      let linesPerSlide: number | undefined;
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString() || "{}");
        content = typeof parsed.content === "string" ? parsed.content : "";
        linesPerSlide =
          typeof parsed.linesPerSlide === "number"
            ? parsed.linesPerSlide
            : undefined;
      } catch {
        res.sendStatus(400);
        return;
      }
      if (!content.trim()) {
        res.sendStatus(400);
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        // no-transform also disables compression middleware buffering
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // Don't buffer SSE
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders?.();

      try {
        for await (const delta of formatLyricsStream(serverPluginApi, content, {
          linesPerSlide,
        })) {
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      } catch (err) {
        logger.error(
          { err },
          "/plugin/lyrics-presenter/ai/format: stream error",
        );
        res.write(
          `data: ${JSON.stringify({
            error: (err as Error).message || "AI formatting failed",
          })}\n\n`,
        );
      } finally {
        res.end();
      }
    });
    req.on("error", () => {
      if (!res.headersSent) res.sendStatus(400);
      else res.end();
    });
  });
  serverPluginApi.onPluginDataCreated(pluginName, onPluginDataCreated);
  serverPluginApi.onPluginDataLoaded(pluginName, onPluginDataLoaded);
  serverPluginApi.onRendererDataCreated(pluginName, onRendererDataCreated);
  serverPluginApi.registerSceneCreator(pluginName, {
    title: "Lyrics Presenter",
    description: "Display song lyrics to the screen",
    categories: ["Display"],
    organizationTypeWhitelist: [OrganizationType.Church],
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
        processSong(
          currentSong?.content ?? "",
          currentSong?.setting?.sectionOrder,
        ),
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
            const prevSong = songs.find((x) => x.id === prevSongId);
            const prevSongMaxIndex = getMaxIndex(
              processSong(
                prevSong?.content ?? "",
                prevSong?.setting?.sectionOrder,
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
  pluginInfo.get("pluginData")?.set("videoBackgrounds", new Y.Array());

  return {};
};

const onPluginDataLoaded = (pluginInfo: ObjectToTypedMap<Plugin>) => {
  migratePluginDataV1ToV2(
    pluginInfo as ObjectToTypedMap<Plugin<PluginBaseData>>,
  );

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

  const cleanupUnusedVideoBackgrounds = () => {
    const usedVideoIds = new Set<string>();

    // Check global style
    const globalStyleVideoId = data.pluginData.style?.backgroundVideoMediaId;
    if (globalStyleVideoId) {
      usedVideoIds.add(globalStyleVideoId);
    }

    // Check all song style overrides
    for (const song of data.pluginData.songs) {
      const songVideoId = song.styleOverride?.backgroundVideoMediaId;
      if (songVideoId) {
        usedVideoIds.add(songVideoId);
      }
    }

    // Remove any videoBackgrounds that are not in use
    const videoBackgrounds = data.pluginData.videoBackgrounds;
    for (let i = videoBackgrounds.length - 1; i >= 0; i--) {
      const video = videoBackgrounds[i];
      if (video && !usedVideoIds.has(video.id)) {
        videoBackgrounds.splice(i, 1);
      }
    }
  };

  // Handle on load
  handleImportSong();
  cleanupUnusedVideoBackgrounds();

  const yjsWatcher = new YjsWatcher(pluginInfo as Y.Map<any>);
  yjsWatcher.watchYjs(
    (x: Plugin<PluginBaseData>) => x.pluginData.songs,
    handleImportSong,
  );

  yjsWatcher.watchYjs(
    (x: Plugin<PluginBaseData>) => x.pluginData.songs,
    cleanupUnusedVideoBackgrounds,
  );
  yjsWatcher.watchYjs(
    (x: Plugin<PluginBaseData>) => x.pluginData.style,
    cleanupUnusedVideoBackgrounds,
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
          } catch (err) {
            logger.error(
              { err, ctx: opts.ctx, input: opts.input },
              "/lyricsPresenter.search: Error",
            );
            throw err;
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
export * from "./sectionOrder";
