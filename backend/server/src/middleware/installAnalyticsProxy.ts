import { Resolver } from "dns";
import { Express, RequestHandler } from "express";
import http from "http";
import { createProxyMiddleware } from "http-proxy-middleware";
import https from "https";
import { LookupFunction, isIP } from "net";

const DEFAULT_ANALYTICS_INGEST_HOST = "https://eu.i.posthog.com";
const DEFAULT_ANALYTICS_ASSET_HOST = "https://eu-assets.i.posthog.com";

const UPSTREAM_TIMEOUT_MS = 10_000;
const OFFLINE_COOLDOWN_MS = 30_000;

// Helps with making sure that a few stalled lookup doesn't hang the entire server
const resolver = new Resolver({ timeout: 3_000, tries: 1 });

const lookup: LookupFunction = (hostname, options, callback) => {
  const family = isIP(hostname);
  if (family) {
    if (options.all) callback(null, [{ address: hostname, family }]);
    else callback(null, hostname, family);
    return;
  }
  resolver.resolve4(hostname, (err, addresses) => {
    if (err || addresses.length === 0) {
      callback(err ?? new Error(`No address for ${hostname}`), "", 4);
    } else if (options.all) {
      callback(
        null,
        addresses.map((address) => ({ address, family: 4 })),
      );
    } else {
      callback(null, addresses[0]!, 4);
    }
  });
};

const makeAgent = (target: string) =>
  target.startsWith("https:")
    ? new https.Agent({ keepAlive: true, lookup })
    : new http.Agent({ keepAlive: true, lookup });

export default (app: Express) => {
  if (!process.env.ANALYTICS_KEY) {
    return;
  }

  const ingestHost =
    process.env.ANALYTICS_INGEST_HOST ?? DEFAULT_ANALYTICS_INGEST_HOST;
  const assetHost =
    process.env.ANALYTICS_ASSET_HOST ?? DEFAULT_ANALYTICS_ASSET_HOST;

  // Fail fast while upstream is unreachable
  let offlineUntil = 0;
  const skipWhileOffline: RequestHandler = (_req, res, next) => {
    if (Date.now() < offlineUntil) {
      res.sendStatus(503);
      return;
    }
    next();
  };

  const proxyOptions = (target: string) => ({
    target,
    changeOrigin: true,
    agent: makeAgent(target),
    proxyTimeout: UPSTREAM_TIMEOUT_MS,
    on: {
      error: (_err: Error, _req: unknown, res: unknown) => {
        offlineUntil = Date.now() + OFFLINE_COOLDOWN_MS;
        if (res instanceof http.ServerResponse && !res.headersSent) {
          res.writeHead(502).end();
        } else {
          (res as { destroy?: () => void }).destroy?.();
        }
      },
    },
  });

  app.use(
    "/ingest/static",
    skipWhileOffline,
    createProxyMiddleware({
      ...proxyOptions(assetHost),
      pathRewrite: (path) => `/static${path}`,
    }),
  );

  app.use(
    "/ingest",
    skipWhileOffline,
    createProxyMiddleware(proxyOptions(ingestHost)),
  );
};
