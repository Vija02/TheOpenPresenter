import { Express, Request } from "express";
import { Server, createServer } from "http";
import { ViteExpress } from "vite-express";

import { getUpgradeHandlers } from "../app";
import { serverPluginApi } from "../pluginManager";
import { DEV_NONCE, getImportMap } from "./shared";

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

  // Load all file from plugins
  return html
    .replace(
      "<!-- injection point -->",
      [getImportMap(req.res?.locals.nonce)]
        .concat(
          registeredLoadJsOnRemoteView.map(
            ({ pluginName, path }) =>
              `<script type="module" src="/plugin/${pluginName}/static/${path}"></script>`,
          ),
        )
        .concat(
          registeredLoadCssOnRemoteView.map(
            ({ pluginName, path }) =>
              `<link rel="stylesheet" type="text/css" href="/plugin/${pluginName}/static/${path}">`,
          ),
        )
        .concat(
          `<script nonce="INJECT_NONCE">window.__APP_DATA__ = { ROOT_URL: "${process.env.ROOT_URL}", CSRF_TOKEN: "${req.csrfToken()}" }</script>`,
        )
        .join("\n"),
    )
    .replace(/INJECT_NONCE/g, req.res?.locals.nonce);
}
