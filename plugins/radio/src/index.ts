import {
  ObjectToTypedMap,
  Plugin,
  PluginContext,
  RegisterOnRendererDataCreated,
  RegisterOnRendererDataLoaded,
  ServerPluginApi,
  TRPCObject,
  YjsWatcher,
} from "@repo/base-plugin/server";
import { TypedArray, extractMediaName } from "@repo/lib";
import { createVideoPlaybackState } from "@repo/video";
import getYouTubeID from "get-youtube-id";
import path from "path";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import * as Y from "yjs";
import { Innertube, UniversalCache } from "youtubei.js";
import z from "zod";

import {
  pluginName,
  remoteWebComponentTag,
  rendererWebComponentTag,
} from "./consts";
import {
  deleteSavedPlaylist,
  insertSavedPlaylist,
  listSavedPlaylists,
  registerLoadedPlugin,
  resolveOrganizationId,
  trackSchema,
  unregisterLoadedPlugin,
  updateSavedPlaylist,
} from "./playlistStore";
import { getSpotifyCollection } from "./spotify";
import { PluginBaseData, PluginRendererData } from "./types";
import { findYoutubeMatches, searchVideos } from "./youtubeMatch";
import { getPlaylistVideos } from "./youtubePlaylist";

const AUDIO_CHECK_INTERVAL_MS = 3000;
const MAX_TRACKS_PER_MATCH = 10;
const MATCH_CONCURRENCY = 5;

let mediaApi: ServerPluginApi["media"];
let serverPluginApiRef: ServerPluginApi;

export const init = (serverPluginApi: ServerPluginApi) => {
  mediaApi = serverPluginApi.media;
  serverPluginApiRef = serverPluginApi;
  serverPluginApi.registerMigrations(
    pluginName,
    path.join(__dirname, "../migrations"),
  );
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
  pluginInfo.get("pluginData")?.set("savedPlaylistId", null);

  return {};
};

const onPluginDataLoaded = (
  pluginInfo: ObjectToTypedMap<Plugin<PluginBaseData>>,
  context: PluginContext,
) => {
  registerLoadedPlugin(context);
  const data = proxy(pluginInfo.toJSON() as Plugin<PluginBaseData>);
  const unbind = bind(data, pluginInfo as any);

  // Library audio picked right after upload can't play until it's processed
  const checking = new Map<string, ReturnType<typeof setInterval>>();
  const stopChecking = (trackId: string) => {
    clearInterval(checking.get(trackId));
    checking.delete(trackId);
  };

  const fillInProcessedAudio = () => {
    for (const track of data.pluginData.tracks) {
      if (
        track.type !== "audio" ||
        track.playbackMediaName ||
        checking.has(track.id)
      ) {
        continue;
      }

      const { id: trackId, mediaName } = track;
      const check = async () => {
        const metadata = await mediaApi
          .getAudioMetadata(extractMediaName(mediaName).uuid)
          .catch(() => undefined);
        if (metadata?.transcodeStatus === "failed") stopChecking(trackId);
        if (metadata?.transcodeStatus !== "completed") return;

        stopChecking(trackId);
        const mutableTrack = data.pluginData.tracks.find(
          (x) => x.id === trackId,
        );
        if (mutableTrack?.type !== "audio") return;

        mutableTrack.playbackMediaName = metadata.playbackMediaName;
        mutableTrack.coverMediaName = metadata.coverMediaName;
        // The tags beat the file name it was given on upload
        if (metadata.title) mutableTrack.metadata.title = metadata.title;
        if (metadata.artist) mutableTrack.metadata.author = metadata.artist;
        if (metadata.duration) {
          mutableTrack.metadata.duration = metadata.duration;
        }
      };

      checking.set(trackId, setInterval(check, AUDIO_CHECK_INTERVAL_MS));
      check();
    }
    for (const trackId of checking.keys()) {
      if (!data.pluginData.tracks.some((x) => x.id === trackId)) {
        stopChecking(trackId);
      }
    }
  };

  fillInProcessedAudio();
  const yjsWatcher = new YjsWatcher(pluginInfo as Y.Map<any>);
  yjsWatcher.watchYjs(
    (x: Plugin<PluginBaseData>) => x.pluginData.tracks,
    fillInProcessedAudio,
  );

  return {
    dispose: () => {
      for (const trackId of [...checking.keys()]) stopChecking(trackId);
      yjsWatcher.dispose();
      unbind();
      unregisterLoadedPlugin(context.pluginId);
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
  rendererData.set("autoplay", true);
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
  // Saved playlists are read and written as the request user, so RLS applies
  const authOf = (ctx: {
    sessionId: string | null;
    screenGuestSessionId: string | null;
  }) => ({
    sessionId: ctx.sessionId,
    screenGuestSessionId: ctx.screenGuestSessionId,
  });

  return t.router({
    musicPlayer: {
      savedPlaylists: {
        list: t.procedure
          .input(z.object({ pluginId: z.string() }))
          .query(({ input, ctx }) =>
            listSavedPlaylists(
              serverPluginApiRef,
              authOf(ctx),
              resolveOrganizationId(input.pluginId),
            ),
          ),

        create: t.procedure
          .input(
            z.object({
              pluginId: z.string(),
              name: z.string().trim().min(1).max(200),
              tracks: z.array(trackSchema),
            }),
          )
          .mutation(({ input, ctx }) =>
            insertSavedPlaylist(serverPluginApiRef, authOf(ctx), {
              organizationId: resolveOrganizationId(input.pluginId),
              userId: ctx.userId,
              name: input.name,
              tracks: input.tracks,
            }),
          ),

        update: t.procedure
          .input(
            z.object({
              pluginId: z.string(),
              id: z.uuid(),
              name: z.string().trim().min(1).max(200).optional(),
              tracks: z.array(trackSchema).optional(),
            }),
          )
          .mutation(async ({ input, ctx }) => {
            const playlist = await updateSavedPlaylist(
              serverPluginApiRef,
              authOf(ctx),
              resolveOrganizationId(input.pluginId),
              input.id,
              { name: input.name, tracks: input.tracks },
            );
            if (!playlist) throw new Error("Playlist not found");
            return playlist;
          }),

        remove: t.procedure
          .input(z.object({ pluginId: z.string(), id: z.uuid() }))
          .mutation(async ({ input, ctx }) => {
            await deleteSavedPlaylist(
              serverPluginApiRef,
              authOf(ctx),
              resolveOrganizationId(input.pluginId),
              input.id,
            );
            return { success: true };
          }),
      },

      search: t.publicProcedure
        .input(
          z.object({
            query: z.string(),
          }),
        )
        .query(async (opts) => {
          const yt = await getInnertube();
          return { results: await searchVideos(yt, opts.input.query) };
        }),

      spotifyCollection: t.publicProcedure
        .input(z.object({ url: z.string() }))
        .mutation((opts) => getSpotifyCollection(opts.input.url)),

      spotifyMatches: t.publicProcedure
        .input(
          z.object({
            tracks: z
              .array(
                z.object({
                  title: z.string(),
                  artist: z.string(),
                  duration: z.number().optional(),
                }),
              )
              .max(MAX_TRACKS_PER_MATCH),
          }),
        )
        .mutation(async (opts) => {
          const yt = await getInnertube();
          const { tracks } = opts.input;
          const matches: Awaited<ReturnType<typeof findYoutubeMatches>>[] = [];
          for (let i = 0; i < tracks.length; i += MATCH_CONCURRENCY) {
            const batch = tracks.slice(i, i + MATCH_CONCURRENCY);
            // One failed search shouldn't lose the rest
            const results = await Promise.all(
              batch.map((track) =>
                findYoutubeMatches(yt, track).catch(() => []),
              ),
            );
            matches.push(...results);
          }
          return { matches };
        }),

      youtubeMetadata: t.publicProcedure
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

      youtubePlaylist: t.publicProcedure
        .input(
          z.object({
            playlistId: z.string().min(1),
          }),
        )
        .mutation(async (opts) => {
          const yt = await getInnertube();
          return getPlaylistVideos(yt, opts.input.playlistId);
        }),
    },
  });
};

export type AppRouter = ReturnType<typeof getAppRouter>;

export * from "./types";
