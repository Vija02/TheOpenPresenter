import { logger } from "@repo/observability";
import axios, { AxiosError } from "axios";
import { createSession } from "better-sse";
import { EventSourcePlus } from "event-source-plus";
import { Express } from "express";
import setCookieParse from "set-cookie-parser";

import { withUserPgPool } from "../utils/withUserPgPool";
import { getRootPgPool } from "./installDatabasePools";

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
      await withUserPgPool(app, req.user?.session_id ?? "", async (client) => {
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
    } catch (e) {
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
                }
              }
              if (!cookieString) {
                throw e;
              }
            }

            const rootPgPool = getRootPgPool(app);
            await rootPgPool.query(
              "INSERT INTO app_public.cloud_connections(organization_id, host, session_cookie, creator_user_id) VALUES ($1, $2, $3, $4)",
              [organizationId, targetCloudUrl, cookieString, userId],
            );
            controller.abort();

            session.push({
              done: true,
            });

            res.end();
          }
        } catch (error) {
          console.error(error);
          session.push({ error: "Unexpected error occurred" });
          log.error({ error });
          res.end();
        }
      },
      // Check error
      onResponseError(ctx) {
        log.debug({ error: ctx.error });
        session.push({ error: "Error connecting to server" });
        res.end();
      },
      onRequestError(ctx) {
        log.debug({ error: ctx.error });
        session.push({ error: "Error connecting to server" });
        res.end();
      },
    });

    res.on("close", () => {
      controller.abort();
      res.end();
    });
  });

  // const apiProxy = createProxyMiddleware({
  //   target: targetCloudUrl,
  //   changeOrigin: true,
  //   headers: {
  //     "x-top-csrf-protection": "1",
  //     origin: targetCloudUrl,
  //     // TODO: Insert auth here
  //   },
  //   // on: {
  //   //   proxyReq: (proxyReq) => {
  //   //     console.log(proxyReq);
  //   //     if (proxyReq.path.endsWith("/")) {
  //   //       // proxyReq.path = proxyReq.path.slice(0, -1);
  //   //     }
  //   //   },
  //   // },
  // });

  // app.use(`/cloud/proxy`, apiProxy);
};
