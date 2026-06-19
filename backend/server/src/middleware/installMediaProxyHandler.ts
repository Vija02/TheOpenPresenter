import { isPubliclyAccessibleUrl, isValidMediaName } from "@repo/lib";
import { logger } from "@repo/observability";
import { json } from "body-parser";
import { ChildProcess, spawn } from "child_process";
import { Express } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

import {
  signMediaProxyToken,
  verifyMediaProxyToken,
} from "../utils/mediaProxyToken";
import { findAvailablePort, releasePort, waitForPort } from "./portManager";

// Resource bounds for the tunnel
const MAX_TUNNELS = 16;
const MAX_TUNNEL_MS = 60_000;
const TUNNEL_WARN_THRESHOLD = Math.ceil(MAX_TUNNELS * 0.75);
let activeTunnels = 0;

export default (app: Express) => {
  const enabled = isPubliclyAccessibleUrl(process.env.ROOT_URL);
  if (enabled) {
    logger.debug("Media proxy handler enabled");
    return;
  }

  // Mints a signed, short-lived token for the public /media-proxy URL
  // DEBT: Add auth for better abuse prevention
  app.post("/media-proxy/mint", json(), (req, res) => {
    const { ticket, mediaName } = req.body ?? {};
    if (
      !ticket ||
      typeof ticket !== "string" ||
      !mediaName ||
      typeof mediaName !== "string"
    ) {
      res.status(400).json({ error: "ticket and mediaName are required" });
      return;
    }
    if (!isValidMediaName(mediaName)) {
      res.status(400).json({ error: "invalid mediaName" });
      return;
    }

    const token = signMediaProxyToken({ ticket, mediaName });
    const base = (process.env.ROOT_URL ?? "").replace(/\/$/, "");
    res.json({
      url: `${base}/media-proxy?token=${encodeURIComponent(token)}`,
    });
  });

  // Endpoint to get the media itself
  app.get("/media-proxy", async (req, res) => {
    const token = req.query.token;
    if (typeof token !== "string" || !token) {
      res.sendStatus(400);
      return;
    }

    const claims = verifyMediaProxyToken(token);
    if (!claims) {
      res.sendStatus(403);
      return;
    }
    if (!isValidMediaName(claims.mediaName)) {
      res.sendStatus(400);
      return;
    }

    // Refuse new tunnels once we're at the global cap (before spawning).
    if (activeTunnels >= MAX_TUNNELS) {
      logger.error({ activeTunnels }, "media-proxy: tunnel cap reached");
      res.sendStatus(503);
      return;
    }

    let port: number | undefined;
    let dumbpipe: ChildProcess | undefined;
    let killTimer: NodeJS.Timeout | undefined;
    let cleanedUp = false;

    activeTunnels += 1;

    if (activeTunnels >= TUNNEL_WARN_THRESHOLD) {
      logger.warn(
        { activeTunnels, maxTunnels: MAX_TUNNELS },
        "media-proxy: tunnel usage at/above 75% of cap",
      );
    }

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      activeTunnels -= 1;
      if (killTimer) clearTimeout(killTimer);
      try {
        dumbpipe?.kill();
      } catch {
        // ignore
      }
      if (port !== undefined) releasePort(port);
    };

    // Hard deadline
    killTimer = setTimeout(cleanup, MAX_TUNNEL_MS);

    try {
      port = await findAvailablePort();

      dumbpipe = spawn("dumbpipe", [
        "connect-tcp",
        "--addr",
        `0.0.0.0:${port}`,
        claims.ticket,
      ]);
      dumbpipe.on("exit", cleanup);
      dumbpipe.on("error", (err) => {
        logger.error({ err }, "media-proxy: dumbpipe process error");
        cleanup();
      });
      dumbpipe.stderr?.on("data", (data) => {
        logger.debug({ stderr: data.toString() }, "media-proxy: dumbpipe");
      });

      const portAvailable = await waitForPort(port);
      if (!portAvailable) {
        logger.error({ port }, "media-proxy: tunnel port not ready");
        cleanup();
        if (!res.headersSent) res.sendStatus(502);
        return;
      }

      req.url = `/media/data/${encodeURIComponent(claims.mediaName)}`;

      const proxy = createProxyMiddleware({
        target: `http://localhost:${port}`,
        changeOrigin: true,
        proxyTimeout: 30_000,
        on: {
          error: (err: any, _req: any, r: any) => {
            logger.error({ err }, "media-proxy: proxy error");
            cleanup();
            if (r && !r.headersSent) r.sendStatus(502);
          },
        },
      });

      // Tear the tunnel down as soon as the response finishes
      res.on("close", cleanup);

      proxy(req, res, () => {
        cleanup();
        if (!res.headersSent) res.sendStatus(502);
      });
    } catch (err) {
      logger.error({ err }, "media-proxy: failed to establish tunnel");
      cleanup();
      if (!res.headersSent) res.sendStatus(500);
    }
  });
};
