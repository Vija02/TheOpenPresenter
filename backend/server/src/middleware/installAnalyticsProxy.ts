import { Express } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const DEFAULT_ANALYTICS_INGEST_HOST = "https://eu.i.posthog.com";
const DEFAULT_ANALYTICS_ASSET_HOST = "https://eu-assets.i.posthog.com";

export default (app: Express) => {
  if (!process.env.ANALYTICS_KEY) {
    return;
  }

  const ingestHost =
    process.env.ANALYTICS_INGEST_HOST ?? DEFAULT_ANALYTICS_INGEST_HOST;
  const assetHost =
    process.env.ANALYTICS_ASSET_HOST ?? DEFAULT_ANALYTICS_ASSET_HOST;

  app.use(
    "/ingest/static",
    createProxyMiddleware({
      target: assetHost,
      changeOrigin: true,
      pathRewrite: (path) => `/static${path}`,
    }),
  );

  app.use(
    "/ingest",
    createProxyMiddleware({
      target: ingestHost,
      changeOrigin: true,
    }),
  );
};
