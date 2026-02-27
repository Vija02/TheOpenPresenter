import { logger } from "@repo/observability";
import { json } from "body-parser";
import { ChildProcess, spawn } from "child_process";
import { Express } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { z } from "zod";

import { getShutdownActions, getUpgradeHandlers } from "../app";
import { withUserPgPool } from "../utils/withUserPgPool";
import { getRootPgPool } from "./installDatabasePools";
import { findAvailablePort, releasePort, waitForPort } from "./portManager";

type ConnectionInfo = {
  process: ChildProcess;
  ticket: string;
  port: number;
  hostSessionCookie: string;
  proxy: any; // http-proxy-middleware RequestHandler
};

// Store active dumbpipe connections: key is "organizationSlug:irohEndpointId"
const activeConnections = new Map<string, ConnectionInfo>();

const devicePingSchema = z.object({
  organizationSlug: z.string(),
  irohEndpointId: z.string().min(1),
  irohTicket: z.string().min(1),
  activeProjectIds: z.array(z.string()),
  hostSessionCookie: z.string(),
});

export default (app: Express) => {
  app.use(async (req, res, next) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);

    // Check headers first (for HTTP requests), then query params (for WebSocket)
    const organizationSlug =
      (req.headers["x-organization-slug"] as string) ||
      url.searchParams.get("x-organization-slug");
    const irohEndpointId =
      (req.headers["x-iroh-endpoint-id"] as string) ||
      url.searchParams.get("x-iroh-endpoint-id");

    const shouldProxy = !!organizationSlug && !!irohEndpointId;

    if (!shouldProxy) {
      return next();
    }

    const sessionId = req.user?.session_id;

    // If no session id, then not logged in
    if (!sessionId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      // First, verify user has access to the organization
      let organizationId: string | null = null;

      await withUserPgPool(app, sessionId, async (client) => {
        const orgResult = await client.query(
          `SELECT id FROM app_public.organizations WHERE slug = $1`,
          [organizationSlug],
        );

        if (orgResult.rows.length === 0) {
          res.status(403).json({ error: "Unauthorized" });
          return;
        }

        organizationId = orgResult.rows[0].id;
      });

      const connectionKey = `${organizationSlug}:${irohEndpointId}`;

      let connectionInfo = activeConnections.get(connectionKey);

      // Only fetch ticket from DB if we need to create a new connection
      let irohTicket: string | null = null;
      let hostSessionCookie: string | null = null;

      // Check if we need to fetch the ticket and create a new connection
      const needsNewConnection =
        !connectionInfo ||
        connectionInfo.process.killed ||
        connectionInfo.process.exitCode !== null;

      if (needsNewConnection) {
        // Fetch the ticket and host session cookie from the database
        await withUserPgPool(app, sessionId, async (client) => {
          const ticketResult = await client.query(
            `SELECT iroh_ticket, host_session_cookie
             FROM app_public.organization_active_devices
             WHERE organization_id = $1 AND iroh_endpoint_id = $2 AND updated_at > NOW() - INTERVAL '90 seconds'`,
            [organizationId, irohEndpointId],
          );

          if (
            ticketResult.rows.length === 0 ||
            !ticketResult.rows[0].iroh_ticket
          ) {
            res.status(500).json({
              errors: [
                {
                  code: "EPROXYUNKNOWN",
                  message: "Device not found or not active",
                },
              ],
            });
            return;
          }

          irohTicket = ticketResult.rows[0].iroh_ticket;
          hostSessionCookie = ticketResult.rows[0].host_session_cookie;
        });

        if (!irohTicket || !hostSessionCookie) return;

        // Check if ticket changed (if we had an old connection)
        const ticketChanged =
          connectionInfo && connectionInfo.ticket !== irohTicket;

        // Clean up old connection if it exists and ticket changed
        if (connectionInfo && ticketChanged) {
          logger.info(
            { organizationSlug, irohEndpointId },
            "Ticket changed, cleaning up old dumbpipe connection",
          );
          connectionInfo.process.kill();
          activeConnections.delete(connectionKey);
        }

        if (!connectionInfo || ticketChanged) {
          logger.info(
            { organizationSlug, irohEndpointId },
            "Spawning new dumbpipe connection",
          );

          const port = await findAvailablePort();

          logger.debug(
            { organizationSlug, irohEndpointId, port },
            "Using port for dumbpipe TCP connection",
          );

          // Spawn dumbpipe process to connect to the device via TCP
          const dumbpipe = spawn("dumbpipe", [
            "connect-tcp",
            "--addr",
            `0.0.0.0:${port}`,
            irohTicket!,
          ]);

          // Create proxy for this connection
          const proxy = createProxyMiddleware({
            target: `http://localhost:${port}`,
            changeOrigin: true,
            logger: console as any,
            proxyTimeout: 10_000,
            on: {
              proxyReq: (proxyReq, req) => {
                // Strip proxy headers to prevent infinite loops
                proxyReq.removeHeader("x-organization-slug");
                proxyReq.removeHeader("x-iroh-endpoint-id");

                // Strip proxy query parameters (for WebSocket connections)
                if (req.url) {
                  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
                  reqUrl.searchParams.delete("x-organization-slug");
                  reqUrl.searchParams.delete("x-iroh-endpoint-id");
                  proxyReq.path = reqUrl.pathname + reqUrl.search;
                }

                if (hostSessionCookie) {
                  proxyReq.setHeader("Cookie", hostSessionCookie);
                }

                logger.debug(
                  {
                    organizationSlug,
                    irohEndpointId,
                    port,
                    path: req.url,
                    hasHostSessionCookie: !!hostSessionCookie,
                  },
                  "Proxying request to TCP port",
                );
              },
              proxyRes: (proxyRes) => {
                logger.debug(
                  {
                    organizationSlug,
                    irohEndpointId,
                    statusCode: proxyRes.statusCode,
                  },
                  "Received response from TCP port",
                );
              },
              proxyReqWs: (proxyReq) => {
                if (hostSessionCookie) {
                  proxyReq.setHeader("Cookie", hostSessionCookie);
                }
                logger.debug(
                  {
                    organizationSlug,
                    irohEndpointId,
                    port,
                  },
                  "Proxying WebSocket upgrade",
                );
              },
              econnreset: (err, req, res: any) => {
                // This should not be reached because we have a 10s timeout
                logger.error(
                  { err, organizationSlug, irohEndpointId },
                  "ECONNRESET - unexpected, should not be reached due to timeout",
                );
                if (res && !res.headersSent) {
                  res.status(500).json({
                    errors: [
                      {
                        code: "EPROXYUNREACHABLE",
                        message: "Host unreachable",
                      },
                    ],
                  });
                }
              },
              error: (err: any, req, res: any) => {
                const isTimeout = err?.code === "ECONNRESET";

                if (isTimeout) {
                  logger.info(
                    { err, organizationSlug, irohEndpointId },
                    "Proxy timeout - socket hang up",
                  );
                } else {
                  logger.error(
                    { err, organizationSlug, irohEndpointId },
                    "Proxy error",
                  );
                }

                // Clean up the connection when host is unreachable
                activeConnections.delete(connectionKey);
                releasePort(port);
                connectionInfo!.process.kill();

                if (res && !res.headersSent) {
                  console.log("HEADER NOT SENT, SENDING 500");
                  res.status(500).json({
                    errors: [
                      {
                        code: "EPROXYUNREACHABLE",
                        message: "Host unreachable",
                      },
                    ],
                  });
                }
              },
            },
          });

          // Store the connection
          connectionInfo = {
            process: dumbpipe,
            ticket: irohTicket!,
            port,
            hostSessionCookie: hostSessionCookie!,
            proxy,
          };
          activeConnections.set(connectionKey, connectionInfo);

          // Log stderr for debugging
          dumbpipe.stderr.on("data", (data) => {
            logger.debug(
              { organizationSlug, irohEndpointId, stderr: data.toString() },
              "dumbpipe stderr",
            );
          });

          // Log stdout for debugging
          dumbpipe.stdout.on("data", (data) => {
            logger.debug(
              { organizationSlug, irohEndpointId, stdout: data.toString() },
              "dumbpipe stdout",
            );
          });

          // Handle process exit - clean up from map and release port
          dumbpipe.on("exit", (code, signal) => {
            logger.info(
              { organizationSlug, irohEndpointId, code, signal, port },
              "dumbpipe process exited, removing from active connections",
            );
            activeConnections.delete(connectionKey);
            releasePort(port);
          });

          // Handle errors
          dumbpipe.on("error", (err) => {
            logger.error(
              { err, organizationSlug, irohEndpointId },
              "dumbpipe process error",
            );
            activeConnections.delete(connectionKey);
            releasePort(port);
          });
        }
      } else {
        logger.debug(
          { organizationSlug, irohEndpointId },
          "Reusing existing dumbpipe connection",
        );
      }

      // Ensure we have a connection at this point
      if (!connectionInfo) {
        logger.error(
          { organizationSlug, irohEndpointId },
          "Failed to establish connection",
        );
        res.status(500).json({ error: "Failed to connect to device" });
        return;
      }

      // Wait for TCP port to be available (with timeout)
      const portAvailable = await waitForPort(connectionInfo.port);
      if (!portAvailable) {
        logger.fatal(
          {
            organizationSlug,
            irohEndpointId,
            port: connectionInfo.port,
          },
          "TCP port not available after timeout",
        );
        res.status(500).json({
          errors: [
            {
              code: "EPROXYUNREACHABLE",
              message: "Unable to get TCP port",
            },
          ],
        });
        return;
      }

      // Use the proxy from the connection
      connectionInfo.proxy(req, res, next);
    } catch (err) {
      logger.error(
        { err, organizationSlug, irohEndpointId },
        "Failed to proxy request",
      );
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to proxy request" });
      }
    }
  });

  /**
   * This is how we know the devices that are active
   */
  app.post("/device/server/ping", json(), async (req, res) => {
    const sessionId = req.user?.session_id;

    // If no session id, then not logged in
    if (!sessionId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    // Validate request body with Zod
    const parseResult = devicePingSchema.safeParse(req.body);
    if (!parseResult.success) {
      logger.debug({ body: req.body }, "Invalid body on device ping");
      res.status(400).json({
        error: "Invalid request body",
        details: parseResult.error.flatten(),
      });
      return;
    }

    // DEBT: This should take just the ticket, and we can infer the endpoint from there
    const {
      organizationSlug,
      irohEndpointId,
      irohTicket,
      activeProjectIds,
      hostSessionCookie,
    } = parseResult.data;

    try {
      await withUserPgPool(app, sessionId, async (client) => {
        await client.query(
          `INSERT INTO app_public.organization_active_devices (organization_id, iroh_endpoint_id, iroh_ticket, active_project_ids, host_session_cookie, updated_at)
           VALUES ((SELECT id FROM app_public.organizations WHERE slug = $1), $2, $3, $4, $5, NOW())
           ON CONFLICT (organization_id, iroh_endpoint_id)
           DO UPDATE SET
             iroh_ticket = EXCLUDED.iroh_ticket,
             active_project_ids = EXCLUDED.active_project_ids,
             host_session_cookie = EXCLUDED.host_session_cookie,
             updated_at = NOW()`,
          [
            organizationSlug,
            irohEndpointId,
            irohTicket,
            activeProjectIds,
            hostSessionCookie,
          ],
        );
      });

      res.status(200).json({ success: true });
    } catch (err) {
      // DEBT: don't error if invalid org
      logger.error({ err }, "Failed to process device ping");
      res.status(500).json({ error: "Failed to update device status" });
    }
  });

  // WebSocket upgrade handler for proxy connections
  const upgradeHandlers = getUpgradeHandlers(app);
  upgradeHandlers.push({
    name: "DeviceProxy",
    check(req) {
      const url = new URL(req.url ?? "", `http://${req.headers.host}`);
      const organizationSlug = url.searchParams.get("x-organization-slug");
      const irohEndpointId = url.searchParams.get("x-iroh-endpoint-id");
      return !!organizationSlug && !!irohEndpointId;
    },
    async upgrade(req, socket, head) {
      try {
        const url = new URL(req.url ?? "", `http://${req.headers.host}`);
        const organizationSlug = url.searchParams.get("x-organization-slug")!;
        const irohEndpointId = url.searchParams.get("x-iroh-endpoint-id")!;

        const connectionKey = `${organizationSlug}:${irohEndpointId}`;
        const connectionInfo = activeConnections.get(connectionKey);

        if (!connectionInfo) {
          logger.warn(
            { organizationSlug, irohEndpointId },
            "No connection info for WebSocket proxy - HTTP request must establish connection first",
          );
          socket.destroy();
          return;
        }

        // Strip proxy query params from URL
        url.searchParams.delete("x-organization-slug");
        url.searchParams.delete("x-iroh-endpoint-id");
        req.url = url.pathname + url.search;

        // Use the proxy from the connection
        connectionInfo.proxy.upgrade!(req, socket as any, head);
      } catch (err) {
        logger.error({ err }, "Failed to handle WebSocket proxy upgrade");
        socket.destroy();
      }
    },
  });

  // Cleanup stale connections every 5 minutes
  const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  const cleanupStaleConnections = async () => {
    const rootPgPool = getRootPgPool(app);

    try {
      // Delete stale entries and return the deleted rows with org slug
      const { rows: deletedDevices } = await rootPgPool.query<{
        organization_slug: string;
        iroh_endpoint_id: string;
      }>(`
        DELETE FROM app_public.organization_active_devices d
        USING app_public.organizations o
        WHERE d.organization_id = o.id
          AND d.updated_at <= NOW() - INTERVAL '90 seconds'
        RETURNING o.slug as organization_slug, d.iroh_endpoint_id
      `);

      if (deletedDevices.length > 0) {
        logger.info(
          { count: deletedDevices.length },
          "Deleted stale organization_active_devices entries",
        );
      }

      // Skip connection cleanup if no active connections
      if (activeConnections.size === 0) {
        return;
      }

      // Clean up dumbpipe connections for deleted devices
      for (const device of deletedDevices) {
        const connectionKey = `${device.organization_slug}:${device.iroh_endpoint_id}`;
        const connectionInfo = activeConnections.get(connectionKey);

        if (connectionInfo) {
          logger.info(
            { connectionKey },
            "Cleaning up stale dumbpipe connection - device no longer active in database",
          );

          connectionInfo.process.kill();
          activeConnections.delete(connectionKey);
          releasePort(connectionInfo.port);
        }
      }
    } catch (err) {
      logger.error({ err }, "Failed to cleanup stale connections");
    }
  };

  const cleanupInterval = setInterval(
    cleanupStaleConnections,
    CLEANUP_INTERVAL_MS,
  );

  // Register cleanup on shutdown
  const shutdownActions = getShutdownActions(app);
  shutdownActions.push(() => {
    clearInterval(cleanupInterval);

    // Clean up all active connections on shutdown
    for (const [connectionKey, connectionInfo] of activeConnections) {
      logger.info(
        { connectionKey },
        "Cleaning up dumbpipe connection on shutdown",
      );
      connectionInfo.process.kill();
      releasePort(connectionInfo.port);
    }
    activeConnections.clear();
  });
};
