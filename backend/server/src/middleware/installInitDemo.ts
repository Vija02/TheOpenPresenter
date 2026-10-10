import { YjsState } from "@repo/base-plugin/server";
import {
  type LayoutDoc,
  createLayoutDoc,
  createShapeElement,
  videoPaint,
} from "@repo/layout";
import { logger } from "@repo/observability";
import type { Video } from "@repo/video";
import { createSession } from "better-sse";
import { Express } from "express";
import * as redis from "redis";
import { typeidUnboxed } from "typeid-js";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import * as Y from "yjs";

import { DEMO_RADIO_TRACKS } from "./demoRadioTracks";
import { DEMO_SONGS } from "./demoSongs";
import { getRootPgPool } from "./installDatabasePools";

async function createRedisClient() {
  const client = redis.createClient({ url: process.env.REDIS_URL });
  await client.connect();
  return client;
}

const initDemoChannel = (id: string) => "init-demo:id:" + id;

/**
 * Local mirror of the plugin's pluginData shape. We don't import directly
 * to keep the server free of a runtime dep on the plugins
 */
type SlidesImportData = {
  importId: string;
  name?: string;
  fetchId: string;
  type: "pdf";
  thumbnailLinks: string[];
  slideClickCounts: number[];
  slideIds: string[];
};
type SlidesPluginData = {
  imports: Record<string, SlidesImportData>;
  slideOrder: string[];
};
type VideoPluginData = {
  videos: Video[];
};
type RadioPluginData = {
  url: string;
  tracks: unknown[];
};
type BiblePluginData = {
  passages: unknown[];
};
type LyricsPluginData = {
  songs: unknown[];
  looks: Record<string, unknown>;
};

/**
 * Slug of the seeded organization that owns every demo project. The row is
 * inserted by the migration in `backend/db/migrations/current/100-current.sql`.
 */
const DEMO_ORG_SLUG = "demo";

/**
 * Default HLS video used by the seeded video-player plugin.
 */
const DEMO_VIDEO_URL =
  "https://stream.mux.com/VcmKA6aqzIzlg3MayLJDnbF55kX00mds028Z65QxvBYaA.m3u8";
const DEMO_VIDEO_THUMBNAIL_URL =
  "https://image.mux.com/VcmKA6aqzIzlg3MayLJDnbF55kX00mds028Z65QxvBYaA/thumbnail.webp?time=2";
const DEMO_VIDEO_TITLE = "Big Buck Bunny (1m)";
const DEMO_VIDEO_DURATION_SECONDS = 60;

/**
 * Image assets are expected to live at
 * `${ROOT_URL}/images/demo/{1..DEMO_SLIDE_COUNT}.jpg`.
 */
const DEMO_SLIDE_COUNT = 5;

type DemoScene = {
  name?: string;
  pluginName: string;
  pluginData:
    | VideoPluginData
    | SlidesPluginData
    | LyricsPluginData
    | RadioPluginData
    | BiblePluginData;
  rendererPluginData?: Record<string, unknown>;
  activate?: boolean;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Build a Yjs document update populated with the given scenes
 */
const buildProjectDocument = async (scenes: DemoScene[]): Promise<Buffer> => {
  const yDoc = YjsState.createEmptyState();
  const state = yDoc.getMap();

  const mainState = proxy({} as any);
  const unbind = bind(mainState, state as any);

  let order = 0;
  let activeSceneId: string | null = null;

  for (const scene of scenes) {
    const sceneId = typeidUnboxed("scene");
    const pluginId = typeidUnboxed("plugin");
    order += 1;
    mainState.data[sceneId] = {
      name: scene.name ?? "",
      order,
      type: "scene",
      children: {
        [pluginId]: {
          plugin: scene.pluginName,
          order: 1,
          pluginData: scene.pluginData,
        },
      },
    };
    if (scene.rendererPluginData) {
      mainState.renderer["1"].children[sceneId] = {
        [pluginId]: scene.rendererPluginData,
      };
    }
    if (scene.activate && !activeSceneId) {
      activeSceneId = sceneId;
    }
  }

  if (activeSceneId) {
    mainState.renderer["1"].currentScene = activeSceneId;
  }

  // Give valtio-yjs a tick to flush its mutations into the underlying Y.Doc
  // before we encode the update.
  await wait(0);
  unbind();
  return Buffer.from(Y.encodeStateAsUpdate(yDoc));
};

/** A Slides scene with the demo deck from `public/images/demo` */
const buildSlidesScene = ({ activate }: { activate: boolean }): DemoScene => {
  const rootUrl = (process.env.ROOT_URL ?? "").replace(/\/$/, "");
  const slidesImportId = typeidUnboxed("import");
  const slidesImport: SlidesImportData = {
    importId: slidesImportId,
    name: "Demo Slides",
    fetchId: typeidUnboxed("fetch"),
    type: "pdf",
    thumbnailLinks: Array.from(
      { length: DEMO_SLIDE_COUNT },
      (_, i) => `${rootUrl}/images/demo/${i + 1}.jpg`,
    ),
    slideClickCounts: Array.from({ length: DEMO_SLIDE_COUNT }, () => 0),
    slideIds: Array.from({ length: DEMO_SLIDE_COUNT }, (_, i) => String(i)),
  };
  return {
    name: "Slides",
    pluginName: "slides",
    activate,
    pluginData: {
      imports: { [slidesImportId]: slidesImport },
      slideOrder: Array.from(
        { length: DEMO_SLIDE_COUNT },
        (_, i) => `${slidesImportId}:${i}`,
      ),
    } satisfies SlidesPluginData,
  };
};

/**
 * Build the default demo scenes: one Slides scene and Video Player scene pre-populated
 */
const buildDemoScenes = (): DemoScene[] => {
  const slidesScene = buildSlidesScene({ activate: true });

  const videoPlayerScene: DemoScene = {
    name: "Video Player",
    pluginName: "video-player",
    pluginData: {
      videos: [
        {
          id: typeidUnboxed("video"),
          url: DEMO_VIDEO_URL,
          metadata: {
            title: DEMO_VIDEO_TITLE,
            thumbnailUrl: DEMO_VIDEO_THUMBNAIL_URL,
            duration: DEMO_VIDEO_DURATION_SECONDS,
          },
        },
      ],
    } satisfies VideoPluginData,
  };

  return [slidesScene, videoPlayerScene];
};

/** Mirrors the lyrics plugin's `MAIN_LOOK` and `BACKGROUND_ELEMENT_ID` */
const LYRICS_MAIN_LOOK = "main";
const LYRICS_BACKGROUND_ELEMENT_ID = "background";

/** Same shape as the lyrics plugin's `backgroundFromMedia` for a video */
const buildVideoBackground = (song: (typeof DEMO_SONGS)[number]): LayoutDoc =>
  createLayoutDoc({
    elements: [
      createShapeElement({
        id: LYRICS_BACKGROUND_ELEMENT_ID,
        name: "Background",
        fill: videoPaint({
          id: typeidUnboxed("video"),
          url: `https://stream.mux.com/${song.muxPlaybackId}.m3u8`,
          hlsMediaName: null,
          thumbnailMediaName: null,
          title: song.backgroundTitle,
          duration: song.backgroundDuration,
          thumbnailUrl: `https://image.mux.com/${song.muxPlaybackId}/thumbnail.webp?time=2`,
        }),
        locked: true,
      }),
    ],
  });

/**
 * Build the church demo: a Lyrics scene, optionally with a few songs each on
 * its own motion background. With songs, it also gets a Music Player stocked
 * with worship tracks, a Video Player with a worship video, a Bible scene with
 * John 3:16, and the demo slide deck
 */
const buildLyricsScenes = ({
  withSongs,
}: {
  withSongs: boolean;
}): DemoScene[] => {
  const songs = (withSongs ? DEMO_SONGS : []).map((song) => ({
    id: typeidUnboxed(),
    title: song.title,
    author: song.author,
    content: song.content,
    setting: { displayType: "sections" },
    looks: {
      [LYRICS_MAIN_LOOK]: {
        template: null,
        background: buildVideoBackground(song),
      },
    },
    _imported: false,
  }));

  const lyricsScene: DemoScene = {
    name: "Lyrics",
    pluginName: "lyrics-presenter",
    activate: true,
    pluginData: {
      songs,
      looks: {},
    } satisfies LyricsPluginData,
    rendererPluginData: {
      songId: songs[0]?.id ?? null,
      currentIndex: songs.length > 0 ? 0 : null,
      backgroundRun: null,
    },
  };

  if (!withSongs) return [lyricsScene];

  const radioScene: DemoScene = {
    name: "Music Player",
    pluginName: "radio",
    pluginData: {
      url: "",
      tracks: DEMO_RADIO_TRACKS,
    } satisfies RadioPluginData,
    rendererPluginData: {
      url: null,
      isPlaying: false,
      volume: 1,
      activeTrackId: DEMO_RADIO_TRACKS[0]?.id ?? null,
      trackState: {
        uid: Math.random().toString(),
        isPlaying: false,
        volume: 1,
        muted: false,
        seek: 0,
        startedAt: Date.now(),
        onFinishBehaviour: "pause",
      },
      repeatMode: "off",
      crossfadeSeconds: 0,
      fadingOutTrack: null,
    },
  };

  const DEMO_VIDEO_ID = "video_01m4hka33heshvgw7d703rhw6g";
  const videoPlayerScene: DemoScene = {
    name: "Video Player",
    pluginName: "video-player",
    pluginData: {
      videos: [
        {
          id: DEMO_VIDEO_ID,
          url: "https://www.youtube.com/watch?v=f2oxGYpuLkw",
          metadata: {
            title:
              "Praise (feat. Brandon Lake, Chris Brown & Chandler Moore) | Elevation Worship",
            duration: 305,
            thumbnailUrl:
              "https://i.ytimg.com/vi/f2oxGYpuLkw/hq720.jpg?sqp=-oaymwEjCOgCEMoBSFryq4qpAxUIARUAAAAAGAElAADIQj0AgKJDeAE=&rs=AOn4CLACfuL-mxsLTHZ6OzzBH6EdPpFWNg",
          },
        },
      ],
    } satisfies VideoPluginData,
    rendererPluginData: {
      activeVideoId: DEMO_VIDEO_ID,
      videoStates: {
        [DEMO_VIDEO_ID]: {
          uid: Math.random().toString(),
          isPlaying: false,
          volume: 1,
          seek: 0,
          startedAt: Date.now(),
          onFinishBehaviour: "pause",
        },
      },
    },
  };

  const bibleScene: DemoScene = {
    name: "Bible",
    pluginName: "bible",
    pluginData: {
      passages: [
        {
          id: typeidUnboxed(),
          reference: "John 3:16",
          translationId: "eng_kjv",
          translationName: "King James (Authorized) Version",
          translationAbbreviation: "KJAV",
          verses: [
            {
              bookId: "JHN",
              bookName: "John",
              chapter: 3,
              verse: 16,
              text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
            },
          ],
        },
      ],
    } satisfies BiblePluginData,
  };

  return [
    lyricsScene,
    radioScene,
    videoPlayerScene,
    bibleScene,
    buildSlidesScene({ activate: false }),
  ];
};

export default async (app: Express) => {
  const rootPgPool = getRootPgPool(app);

  const subscribeClient = process.env.REDIS_URL
    ? await createRedisClient()
    : null;
  const publishClient = process.env.REDIS_URL
    ? await createRedisClient()
    : null;

  // ---------------------------------------------------------------------------
  // SSE pairing channel
  // ---------------------------------------------------------------------------
  if (subscribeClient) {
    app.get("/init-demo/request", async (req, res) => {
      const session = await createSession(req, res, { keepAlive: 60_000 });
      const id = typeidUnboxed();
      const channel = initDemoChannel(id);

      logger.trace({ pairId: id, channel }, "/init-demo/request SSE opened");
      session.push({ id });

      const listener = (message: string) => {
        try {
          const payload = JSON.parse(message) as {
            orgSlug: string;
            projectSlug: string;
          };
          logger.trace(
            { pairId: id, channel, payload },
            "/init-demo/request received pair-up payload",
          );
          session.push({ done: true, ...payload });
        } catch (err) {
          logger.warn(
            { err, pairId: id, channel, message },
            "/init-demo/request dropped malformed pair-up payload",
          );
        }
        subscribeClient.unsubscribe(channel, listener);
        res.end();
      };

      await subscribeClient.subscribe(channel, listener);

      res.on("close", () => {
        logger.trace({ pairId: id, channel }, "/init-demo/request SSE closed");
        subscribeClient.unsubscribe(channel, listener);
        res.end();
      });
    });
  }

  // Note: This endpoint creates a temporary project in the demo organization.
  // We clean this up in installHocuspocus.ts by detecting when a document is no longer active
  // (after a grace period, so a refresh/reconnect doesn't lose the demo)
  // We also clean it up in a cronjob for projects over 1 day old
  app.get("/init-demo", async (req, res) => {
    const pairId = req.query.id?.toString();
    const template = req.query.template?.toString();
    const organizationType = req.query.organizationType?.toString();

    try {
      const { rows: orgRows } = await rootPgPool.query(
        "select id from app_public.organizations where slug = $1",
        [DEMO_ORG_SLUG],
      );
      if (orgRows.length === 0) {
        logger.error(
          { demoOrgSlug: DEMO_ORG_SLUG },
          "/init-demo aborted: demo organization is not seeded",
        );
        res.status(500).json({
          error:
            "Demo organization is not seeded. Run database migrations first.",
        });
        return;
      }
      const orgId = orgRows[0].id;

      // Random slug per call so concurrent /init-demo hits don't collide on
      // the (organization_id, slug) unique constraint.
      const slug = "demo-" + Math.random().toString(36).slice(2, 14);

      const {
        rows: [project],
      } = await rootPgPool.query(
        `insert into app_public.projects
           (organization_id, name, slug, is_public, is_temporary)
         values ($1, $2, $3, true, true)
         returning id, slug`,
        [orgId, "Demo project", slug],
      );
      logger.info(
        { projectId: project.id, projectSlug: project.slug, orgId, pairId },
        "/init-demo created demo project",
      );

      // `lyrics` is an empty Lyrics scene, `lyrics-songs` comes with songs
      const scenes =
        template === "lyrics-songs"
          ? buildLyricsScenes({ withSongs: true })
          : template === "lyrics"
            ? buildLyricsScenes({ withSongs: false })
            : buildDemoScenes();
      const update = await buildProjectDocument(scenes);
      await rootPgPool.query(
        "update app_public.projects set document = $1 where id = $2",
        [update, project.id],
      );

      // If the request was initiated via the SSE pairing flow, notify the
      // waiting homepage so it can embed the renderer.
      if (pairId && publishClient) {
        try {
          await publishClient.publish(
            initDemoChannel(pairId),
            JSON.stringify({
              orgSlug: DEMO_ORG_SLUG,
              projectSlug: project.slug,
            }),
          );
          logger.trace(
            { pairId, projectSlug: project.slug },
            "/init-demo notified SSE listener",
          );
        } catch (err) {
          // Don't fail the redirect if the notify hop fails.
          logger.error(
            { err, pairId, projectSlug: project.slug },
            "/init-demo failed to notify SSE listener",
          );
        }
      }

      const appUrl = organizationType
        ? `/app/${DEMO_ORG_SLUG}/${project.slug}?organizationType=${encodeURIComponent(organizationType)}`
        : `/app/${DEMO_ORG_SLUG}/${project.slug}`;
      res.redirect(appUrl);
    } catch (err: any) {
      logger.error({ err, pairId }, "/init-demo failed");
      res
        .status(500)
        .json({ error: { message: err.message, stack: err.stack } });
    }
  });
};
