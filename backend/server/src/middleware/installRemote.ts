import { Express, Request } from "express";
import { Server, createServer } from "http";
import { ViteExpress } from "vite-express";

import { getUpgradeHandlers } from "../app";
import { serverPluginApi } from "../pluginManager";
import { injectEndOfHead } from "../utils/injectHtml";
import { DEV_NONCE } from "./shared";

export default async function installRemote(app: Express, server: Server) {
  const fakeHttpServer = createServer();
  const viteExpress = new ViteExpress();

  viteExpress.config({
    mode: process.env.NODE_ENV === "production" ? "production" : "development",
    inlineViteConfig: {
      ...(process.env.NODE_ENV === "production"
        ? {}
        : {
            html: {
              cspNonce: DEV_NONCE,
            },
          }),
      root: `${__dirname}/../../../apps/remote`,
      base: "/app",
      build: { outDir: "dist" },
      server: {
        hmr: {
          server: fakeHttpServer,
        },
      },
    },
    transformer,
  });
  await viteExpress.bind(app, server);

  const upgradeHandler = fakeHttpServer.listeners("upgrade")[0] as any;
  if (upgradeHandler) {
    const upgradeHandlers = getUpgradeHandlers(app);
    upgradeHandlers.push({
      name: "Remote Handler",
      check(req) {
        return (req.url === "/app" || req.url?.startsWith("/app")) ?? false;
      },
      upgrade: upgradeHandler,
    });
  }
}

function transformer(html: string, req: Request) {
  const registeredLoadJsOnRemoteView =
    serverPluginApi.getRegisteredLoadJsOnRemoteView();
  const registeredLoadCssOnRemoteView =
    serverPluginApi.getRegisteredLoadCssOnRemoteView();
  const registeredEnvToViews = serverPluginApi.getRegisteredEnvToViews();

  const scripts = [];

  // TODO: Load only plugins that are active
  // Load all file from plugins
  scripts.push(
    ...registeredLoadJsOnRemoteView.map(
      ({ pluginName, path }) =>
        `<script type="module" src="/plugin/${pluginName}/static/${path}"></script>`,
    ),
  );
  scripts.push(
    ...registeredLoadCssOnRemoteView.map(
      ({ pluginName, path }) =>
        `<link rel="stylesheet" type="text/css" href="/plugin/${pluginName}/static/${path}">`,
    ),
  );

  // Extra data
  const extraEnv = [
    { ROOT_URL: process.env.ROOT_URL, CSRF_TOKEN: req.csrfToken() } as Record<
      string,
      string
    >,
  ]
    .concat(registeredEnvToViews.map((x) => x.envVars))
    .reduce((acc, val) => ({ ...acc, ...val }), {} as Record<string, string>);

  scripts.push(
    `<script nonce="INJECT_NONCE">window.__APP_DATA__ = { ${Object.entries(
      extraEnv,
    )
      .map(([key, val]) => `${key}: "${val}"`)
      .join(", ")} }</script>`,
  );

  return injectEndOfHead(html, scripts.join("\n")).replace(
    /INJECT_NONCE/g,
    req.res?.locals.nonce,
  );
}
