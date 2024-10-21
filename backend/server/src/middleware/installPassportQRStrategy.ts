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
      res.status(500).json({
        error: "This authentication method is not enabled in the server",
      });
      return;
    });

    return;
  }

  // Request the QR Code. Should be called by the authenticated user
  app.get("/qr-auth/request", (req, res) => {
    // Set headers for SSE
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Generate the ID for the client
    const id = typeidUnboxed();

    res.write(`data: {"id": "${id}"}\n\n`);

    // Send keep alive messages to keep the connection on
    const keepAliveInterval = setInterval(() => {
      res.write(":\n\n");
    }, 60 * 1000);

    const listener = async (message: string) => {
      // When user successfully logged in
      const token = typeidUnboxed();

      await client.set(getKeyForToken(token), message);
      res.write(`data: {"done": true, "token": "${token}"}\n\n`);

      clearInterval(keepAliveInterval);
      subscribeClient.unsubscribe(getChannelForId(id), listener);
      res.end();
    };

    subscribeClient.subscribe(getChannelForId(id), listener);

    // If client closes connection, stop sending events
    res.on("close", () => {
      clearInterval(keepAliveInterval);
      subscribeClient.unsubscribe(getChannelForId(id), listener);
      res.end();
    });
  });

  // Authorize the ID that has been generated from the method above.
  // Should be called by the authenticated user
  app.get("/qr-auth/auth", async (req, res) => {
    if (!req.user?.session_id) {
      // TODO: Redirect to login
      res.status(401).json({
        error: "You are not authenticated",
      });
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
      res.redirect("/o");
    });
  });
};
