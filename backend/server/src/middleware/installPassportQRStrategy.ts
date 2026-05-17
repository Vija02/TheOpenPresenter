import { logger } from "@repo/observability";
import { createSession } from "better-sse";
import { Express, Response } from "express";
import * as redis from "redis";
import { typeidUnboxed } from "typeid-js";

import { applySessionMaxAge } from "./installSession";
import { getRootPgPool } from "./installDatabasePools";

async function createRedisClient() {
  const client = redis.createClient({
    url: process.env.REDIS_URL,
  });
  await client.connect();

  return client;
}

type RedisClient = Awaited<ReturnType<typeof createRedisClient>>;

const channels = {
  login: (id: string) => "qr-strategy:id:" + id,
  screenSelect: (id: string) => "qr-strategy:screen-select:id:" + id,
};

const loginTokenKey = (token: string) => "qr-strategy:" + token;

/**
 * Mount an SSE route that:
 *   1. Generates an id and pushes `{ id }` to the client.
 *   2. Subscribes to a Redis channel scoped to that id. When a message
 *      arrives, runs `transform`, pushes `{ done: true, ...payload }`, then
 *      closes the stream.
 *
 * Used as the "displaying device" side of a QR flow.
 */
const installSseQrRequestRoute = <TPayload extends object>(
  app: Express,
  path: string,
  subscribeClient: RedisClient,
  opts: {
    channelKey: (id: string) => string;
    transform: (message: string) => Promise<TPayload> | TPayload;
  },
) => {
  app.get(path, async (req, res) => {
    const session = await createSession(req, res, { keepAlive: 60_000 }); // Ping every minute
    const id = typeidUnboxed();
    const channel = opts.channelKey(id);

    session.push({ id });

    const listener = async (message: string) => {
      try {
        const payload = await opts.transform(message);
        session.push({ done: true, ...payload });
      } catch {
        // Bad payload — drop it
      }
      subscribeClient.unsubscribe(channel, listener);
      res.end();
    };

    subscribeClient.subscribe(channel, listener);

    // If client closes connection, stop sending events
    res.on("close", () => {
      subscribeClient.unsubscribe(channel, listener);
      res.end();
    });
  });
};

const publishAndRedirect = async (
  res: Response,
  publishClient: RedisClient,
  channel: string,
  message: string,
) => {
  const success = await publishClient.publish(channel, message);
  res.redirect(success ? "/qr-login-success" : "/qr-login-failed");
};

export default async (app: Express) => {
  const client = process.env.REDIS_URL ? await createRedisClient() : null;
  const subscribeClient = process.env.REDIS_URL
    ? await createRedisClient()
    : null;
  const publishClient = process.env.REDIS_URL
    ? await createRedisClient()
    : null;

  // Make sure we have redis
  if (!client || !subscribeClient || !publishClient) {
    app.use("/qr-auth", (_req, res) => {
      logger.warn(
        "/qr-auth endpoint hit but Redis is not enabled on this server",
      );
      res.status(500).json({
        error: "This authentication method is not enabled in the server",
      });
      return;
    });

    return;
  }

  // ===========================================================================
  // Login QR flow
  // ===========================================================================
  installSseQrRequestRoute(app, "/qr-auth/request", subscribeClient, {
    channelKey: channels.login,
    transform: async (sessionId) => {
      const token = typeidUnboxed();
      await client.setEx(loginTokenKey(token), 600, sessionId);
      return { token };
    },
  });

  // Authorize the ID that has been generated from the method above.
  // Should be called by the authenticated user
  app.get("/qr-auth/auth", async (req, res) => {
    if (!req.user?.session_id) {
      res.redirect(`/login?next=/qr-auth/auth?id=${req.query.id}`);
      return;
    }

    const id = req.query.id?.toString();

    if (!id) {
      res.sendStatus(400);
      return;
    }

    await publishAndRedirect(
      res,
      publishClient,
      channels.login(id),
      req.user.session_id,
    );
  });

  // Displaying device exchanges its short-lived token for a real session.
  app.get("/qr-auth/login", async (req, res) => {
    const returnTo =
      (req.query && req.query.next && String(req.query.next)) ||
      req.session.returnTo;
    const token = req.query.token?.toString();

    if (!token) {
      res.sendStatus(400);
      return;
    }

    const key = loginTokenKey(token);
    const value = await client.get(key);
    await client.del(key);

    if (!value) {
      res.sendStatus(400);
      return;
    }

    const {
      rows: [session],
    } = await getRootPgPool(app).query(
      `insert into app_private.sessions (user_id) select user_id from app_private.sessions where uuid = $1 returning *`,
      [value],
    );
    console.log("Got new session", session.uuid, value)

    applySessionMaxAge(req);
    req.login(
      { session_id: session.uuid },
      { session: true, keepSessionInfo: true },
      () => {
        res.redirect(returnTo || "/o");
      },
    );
  });

  // ===========================================================================
  // Screen-select QR flow
  // ===========================================================================
  installSseQrRequestRoute(
    app,
    "/qr-auth/screen-select/request",
    subscribeClient,
    {
      channelKey: channels.screenSelect,
      transform: (message) =>
        JSON.parse(message) as {
          screen: { screenId: string; screenSlug: string; orgSlug: string };
          loginToken: string;
        },
    },
  );

  // QR target
  app.get("/qr-auth/screen-select/auth", async (req, res) => {
    const id = req.query.id?.toString();
    if (!id) {
      res.sendStatus(400);
      return;
    }

    if (!req.user?.session_id) {
      res.redirect(
        `/login?next=${encodeURIComponent(
          `/qr-auth/screen-select/auth?id=${id}`,
        )}`,
      );
      return;
    }

    res.redirect(`/qr/screen-select?id=${encodeURIComponent(id)}`);
  });

  // Phone submits the chosen screen here.
  app.get("/qr-auth/screen-select/submit", async (req, res) => {
    if (!req.user?.session_id) {
      res.sendStatus(401);
      return;
    }

    const id = req.query.id?.toString();
    const screenId = req.query.screen_id?.toString();
    const screenSlug = req.query.screen_slug?.toString();
    const orgSlug = req.query.org_slug?.toString();

    if (!id || !screenId || !screenSlug || !orgSlug) {
      res.sendStatus(400);
      return;
    }

    const loginToken = typeidUnboxed();
    await client.setEx(loginTokenKey(loginToken), 600, req.user.session_id);

    await publishAndRedirect(
      res,
      publishClient,
      channels.screenSelect(id),
      JSON.stringify({
        screen: { screenId, screenSlug, orgSlug },
        loginToken,
      }),
    );
  });
};
