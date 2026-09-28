import { logger } from "@repo/observability";
import axios, { AxiosError } from "axios";
import { createSession } from "better-sse";
import { json } from "body-parser";
import { EventSourcePlus } from "event-source-plus";
import { Express } from "express";
import setCookieParse from "set-cookie-parser";

import { withUserPgPool } from "../utils/withUserPgPool";
import { getRootPgPool } from "./installDatabasePools";

async function authorizeConnect(
  app: Express,
  sessionId: string,
  organizationId: string,
): Promise<string> {
  let userId = "";
  await withUserPgPool(app, sessionId, async (client) => {
    const {
      rows: [row],
    } = await client.query(
      "select * from app_public.organizations where id = $1",
      [organizationId],
    );
    if (!row) {
      throw new Error("Not Authorized");
    }
    const {
      rows: [user],
    } = await client.query("select app_public.current_user_id() as id");
    userId = user.id;

    const {
      rows: [cloudConnection],
    } = await client.query(
      "select * from app_public.cloud_connections where organization_id = $1",
      [organizationId],
    );
    if (cloudConnection) {
      throw new Error("Already connected to cloud");
    }
  });
  return userId;
}

/** Record a cloud connection. */
async function storeConnection(
  app: Express,
  args: {
    organizationId: string;
    host: string;
    cookie: string;
    expiry: Date;
    userId: string;
  },
): Promise<string> {
  const rootPgPool = getRootPgPool(app);
  const {
    rows: [row],
  } = await rootPgPool.query(
    `INSERT INTO app_public.cloud_connections
       (organization_id, host, session_cookie, session_cookie_expiry, creator_user_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [args.organizationId, args.host, args.cookie, args.expiry, args.userId],
  );
  return row.id;
}

export default (app: Express) => {
  // TODO: Access control for login - user/org
  app.get("/cloud/connect", async (req, res, next) => {
    const session = await createSession(req, res, { keepAlive: 60_000 }); // Ping every minute

    const organizationId = req.query.organizationId;
    if (!organizationId) {
      session.push({ error: "Organization ID is required" });
      return;
    }
    const targetCloudUrl = req.query.remote;
    if (!targetCloudUrl) {
      session.push({ error: "Remote URL is required" });
      return;
    }

    let userId: string | undefined = undefined;

    try {
      userId = await authorizeConnect(
        app,
        req.user?.session_id ?? "",
        String(organizationId),
      );
    } catch (e) {
      logger.debug({ query: req.query }, "Invalid query to /cloud/connect");
      session.push({ error: (e as Error)?.message });
      return;
    }

    const log = logger.child({ organizationId, userId });

    // Start a login attempt to cloud
    const eventSource = new EventSourcePlus(
      targetCloudUrl + "/qr-auth/request",
      { retryStrategy: "on-error" },
    );
    const controller = eventSource.listen({
      async onMessage(ev) {
        try {
          const data = JSON.parse(ev.data);
          if (data.id) {
            // Send auth link over to client to open
            session.push({
              authLink: `${targetCloudUrl}/qr-auth/auth?id=${data.id}`,
            });
          }
          if (data.done) {
            const loginUrl = `${targetCloudUrl}/qr-auth/login?persist-session=1&token=${data.token}&next=/o/`;

            let cookieString = "";
            let cookieExpiry: Date | undefined = new Date();

            try {
              await axios.get(loginUrl, { maxRedirects: 0 });
            } catch (e) {
              if (e instanceof AxiosError) {
                // This endpoint returns a 302. Axios throws that as an error. So we handle it here
                if (e.response?.status === 302) {
                  const setCookieHeader = setCookieParse.parse(
                    e.response.headers["set-cookie"] ?? [],
                    { decodeValues: false },
                  );
                  cookieString = `${setCookieHeader[0]?.name}=${setCookieHeader[0]?.value}`;
                  cookieExpiry = setCookieHeader[0]?.expires;
                }
              }
              if (!cookieString || !cookieExpiry) {
                throw e;
              }
            }

            await storeConnection(app, {
              organizationId: String(organizationId),
              host: String(targetCloudUrl),
              cookie: cookieString,
              expiry: cookieExpiry,
              userId: userId ?? "",
            });
            controller.abort();

            session.push({
              done: true,
            });

            res.end();
          }
        } catch (err) {
          if (err instanceof AxiosError) {
            log.info({ err }, "Error trying to login cloud connection");
          } else {
            log.error(
              { err },
              "Unknown error trying to login cloud connection",
            );
          }
          session.push({ error: "Unexpected error occurred" });
          res.end();
        }
      },
      // Check error
      onResponseError(ctx) {
        log.info(
          { err: ctx.error },
          "Error connecting to remote server for cloud connection. ResponseError.",
        );
        session.push({ error: "Unable to connect to server" });
        res.end();
      },
      onRequestError(ctx) {
        log.info(
          { err: ctx.error },
          "Error connecting to remote server for cloud connection. Request.",
        );
        session.push({ error: "Unable to connect to server" });
        res.end();
      },
    });

    res.on("close", () => {
      controller.abort();
      res.end();
    });
  });

  /** Use to create cloud connection from an existing auth token */
  app.post("/cloud/adopt", json({ limit: "16kb" }), async (req, res) => {
    const { organizationId, host, cookie, expiry } = req.body ?? {};

    if (!organizationId || !host || !cookie) {
      res
        .status(400)
        .json({ error: "organizationId, host and cookie are required" });
      return;
    }

    let userId: string;
    try {
      userId = await authorizeConnect(
        app,
        req.user?.session_id ?? "",
        String(organizationId),
      );
    } catch (e) {
      logger.debug({ organizationId }, "Invalid request to /cloud/adopt");
      res.status(403).json({ error: (e as Error)?.message });
      return;
    }

    // An expiry is required by the schema
    const parsed = expiry ? new Date(String(expiry)) : null;
    const sessionExpiry =
      parsed && !Number.isNaN(parsed.getTime())
        ? parsed
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    try {
      const id = await storeConnection(app, {
        organizationId: String(organizationId),
        host: String(host),
        cookie: String(cookie),
        expiry: sessionExpiry,
        userId,
      });
      res.json({ id });
    } catch (err) {
      logger.error({ err }, "Failed to store an adopted cloud connection");
      res.status(500).json({ error: "Could not store the cloud connection" });
    }
  });
};
