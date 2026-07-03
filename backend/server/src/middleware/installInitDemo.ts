import { YjsState } from "@repo/base-plugin/server";
import { logger } from "@repo/observability";
import type { Video } from "@repo/video";
import { createSession } from "better-sse";
import { Express } from "express";
import * as redis from "redis";
import { typeidUnboxed } from "typeid-js";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import * as Y from "yjs";

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
type LyricsPluginData = {
  songs: unknown[];
  videoBackgrounds: unknown[];
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
  pluginData: VideoPluginData | SlidesPluginData | LyricsPluginData;
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

/**
 * Build the default demo scenes: one Slides scene and Video Player scene pre-populated
 */
const buildDemoScenes = (): DemoScene[] => {
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
  const slidesScene: DemoScene = {
    name: "Slides",
    pluginName: "slides",
    activate: true,
    pluginData: {
      imports: { [slidesImportId]: slidesImport },
      slideOrder: Array.from(
        { length: DEMO_SLIDE_COUNT },
        (_, i) => `${slidesImportId}:${i}`,
      ),
    } satisfies SlidesPluginData,
  };

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

/**
 * Build a minimal demo with just an empty Lyrics plugin
 */
const buildLyricsScenes = (): DemoScene[] => {
  const lyricsScene: DemoScene = {
    name: "Lyrics",
    pluginName: "lyrics-presenter",
    activate: true,
    pluginData: {
      songs: [],
      videoBackgrounds: [],
    } satisfies LyricsPluginData,
  };

  return [lyricsScene];
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
  // We also clean it up in a cronjob for projects over 1 day old
  app.get("/init-demo", async (req, res) => {
    const pairId = req.query.id?.toString();
    const template = req.query.template?.toString();

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

      const scenes =
        template === "lyrics" ? buildLyricsScenes() : buildDemoScenes();
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

      res.redirect(`/app/${DEMO_ORG_SLUG}/${project.slug}`);
    } catch (err: any) {
      logger.error({ err, pairId }, "/init-demo failed");
      res
        .status(500)
        .json({ error: { message: err.message, stack: err.stack } });
    }
  });
};
