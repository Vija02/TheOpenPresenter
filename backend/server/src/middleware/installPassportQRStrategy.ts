import { logger } from "@repo/observability";
import { createSession } from "better-sse";
import { Express } from "express";
import * as redis from "redis";
import { typeidUnboxed } from "typeid-js";

async function createRedisClient() {
  const client = redis.createClient({
    url: process.env.REDIS_URL,
  });
  await client.connect();

  return client;
}

const getChannelForId = (id: string) => {
  return "qr-strategy:id:" + id;
};
const getKeyForToken = (id: string) => {
  return "qr-strategy:" + id;
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

  // Request the QR Code. Should be called by the authenticated user
  app.get("/qr-auth/request", async (req, res) => {
    const session = await createSession(req, res, { keepAlive: 60_000 }); // Ping every minute

    // Generate the ID for the client
    const id = typeidUnboxed();

    session.push({ id });

    const listener = async (message: string) => {
      // When user successfully logged in
      const token = typeidUnboxed();

      await client.setEx(getKeyForToken(token), 600, message);
      session.push({ done: true, token });

      subscribeClient.unsubscribe(getChannelForId(id), listener);
      res.end();
    };

    subscribeClient.subscribe(getChannelForId(id), listener);

    // If client closes connection, stop sending events
    res.on("close", () => {
      subscribeClient.unsubscribe(getChannelForId(id), listener);
      res.end();
    });
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

    const success = await publishClient.publish(
      getChannelForId(id),
      req.user?.session_id,
    );

    if (success) {
      res.redirect("/qr-login-success");
    } else {
      res.redirect("/qr-login-failed");
    }
  });

  // Used to replace the temporary token with a valid session
  // Should be called by the unauthenticated user to finally login
  app.get("/qr-auth/login", async (req, res) => {
    const returnTo =
      (req.query && req.query.next && String(req.query.next)) ||
      req.session.returnTo;
    const token = req.query.token?.toString();

    if (!token) {
      res.sendStatus(400);
      return;
    }

    const key = getKeyForToken(token);
    const value = await client.get(key);
    await client.del(key);

    if (!value) {
      res.sendStatus(400);
      return;
    }

    req.login({ session_id: value }, () => {
      res.redirect(returnTo || "/o");
    });
  });
};
