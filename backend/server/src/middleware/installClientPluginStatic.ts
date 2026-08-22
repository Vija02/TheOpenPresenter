import { Express } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

import { artifactKey, getArtifactStore } from "../clientPlugins/artifactStore";
import { withUserPgPool } from "../utils/withUserPgPool";

export default (app: Express) => {
  const storageProxy = process.env.STORAGE_PROXY;
  if (
    process.env.STORAGE_TYPE === "s3" &&
    storageProxy &&
    storageProxy !== "local" &&
    isValidUrl(storageProxy)
  ) {
    app.use(
      "/cplugin",
      createProxyMiddleware({
        target: storageProxy,
        changeOrigin: true,
        pathRewrite: (path) => `/cplugin${path}`,
        on: {
          proxyRes: (proxyRes) => {
            proxyRes.headers["cache-control"] =
              "public, max-age=31536000, immutable";
          },
        },
      }),
    );
    return;
  }

  // Handle if no proxy
  app.get(
    "/cplugin/:versionId/:filename",
    async (req, res, next): Promise<void> => {
      try {
        const { versionId, filename } = req.params;
        const sessionId = (req.user as any)?.session_id ?? null;

        const version = await withUserPgPool(app, sessionId, async (client) => {
          const {
            rows: [row],
          } = await client.query(
            `select artifacts
               from app_public.client_plugin_versions
              where id = $1 and build_status = 'built'
              limit 1`,
            [versionId],
          );
          return row ?? null;
        });

        if (!version) {
          next();
          return;
        }

        const artifacts = (version.artifacts ?? []) as {
          filename: string;
          contentType: string;
        }[];
        const entry = artifacts.find((a) => a.filename === filename);
        if (!entry) {
          next();
          return;
        }

        const key = artifactKey(versionId, filename);
        const obj = await getArtifactStore().getStream(key);
        if (!obj) {
          next();
          return;
        }

        res.setHeader(
          "Content-Type",
          obj.contentType || entry.contentType || "application/octet-stream",
        );
        // Immutable: (versionId, filename) content never changes.
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        obj.stream.on("error", (err) => next(err));
        obj.stream.pipe(res);
      } catch (err) {
        next(err);
      }
    },
  );
};

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
