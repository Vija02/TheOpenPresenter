import { logger } from "@repo/observability";
import { Express } from "express";

import { getArtifactStore } from "../clientPlugins/artifactStore";
import { createProxyCache } from "../proxyCache";
import { proxyCacheSources } from "../proxyCache/sources";

/**
 * `/proxy-cache/<source>/<upstream path>`: serves an allowed upstream file,
 * fetching and storing it on first use. See `proxyCache/sources.ts`.
 */
export default (app: Express) => {
  const proxyCache = createProxyCache({
    store: getArtifactStore(),
    sources: proxyCacheSources,
  });

  app.get("/proxy-cache/:source/*", async (req, res, next): Promise<void> => {
    const { source } = req.params;
    // Keep the upstream path exactly as requested, query included.
    const pathAndQuery = req.originalUrl.slice(`/proxy-cache/${source}`.length);

    try {
      const file = await proxyCache.get(source, pathAndQuery);
      if (!file) {
        res.sendStatus(404);
        return;
      }

      res.setHeader("Content-Type", file.contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("X-Proxy-Cache", file.hit ? "HIT" : "MISS");
      file.stream.on("error", (err) => next(err));
      file.stream.pipe(res);
    } catch (err) {
      logger.warn({ err, source, pathAndQuery }, "Proxy cache fetch failed");
      res.sendStatus(502);
    }
  });
};
