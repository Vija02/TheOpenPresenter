import { logger } from "@repo/observability";
import { createSession } from "better-sse";
import { Express } from "express";
import * as redis from "redis";
import { typeidUnboxed } from "typeid-js";

import {
  buildDemoScenes,
  buildLyricsScenes,
  buildProjectDocument,
} from "./demoScenes";
import { getRootPgPool } from "./installDatabasePools";

async function createRedisClient() {
  const client = redis.createClient({ url: process.env.REDIS_URL });
  await client.connect();
  return client;
}

const initDemoChannel = (id: string) => "init-demo:id:" + id;

/**
 * Slug of the seeded organization that owns every demo project. The row is
 * inserted by the migration in `backend/db/migrations/current/100-current.sql`.
 */
const DEMO_ORG_SLUG = "demo";

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
