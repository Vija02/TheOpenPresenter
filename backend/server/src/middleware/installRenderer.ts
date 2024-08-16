import { Express, Request } from "express";
import { Server, createServer } from "http";
import { ViteExpress } from "vite-express";

import { getUpgradeHandlers } from "../app";
import { serverPluginApi } from "../pluginManager";
import { injectEndOfHead } from "../utils/injectHtml";
import { DEV_NONCE } from "./shared";

export default async function installRenderer(app: Express, server: Server) {
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
      root: `${__dirname}/../../../apps/renderer`,
      base: "/render",
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
      name: "Renderer Handler",
      check(req) {
        return (
          (req.url === "/render" || req.url?.startsWith("/render")) ?? false
        );
      },
      upgrade: upgradeHandler,
    });
  }
}

function transformer(html: string, req: Request) {
  const registeredLoadJsOnRendererView =
    serverPluginApi.getRegisteredLoadJsOnRendererView();
  const registeredLoadCssOnRendererView =
    serverPluginApi.getRegisteredLoadCssOnRendererView();

  const scripts = [];

  // Load all file from plugins
  scripts.push(
    ...registeredLoadJsOnRendererView.map(
      ({ pluginName, path }) =>
        `<script type="module" src="/plugin/${pluginName}/static/${path}"></script>`,
    ),
  );
  scripts.push(
    ...registeredLoadCssOnRendererView.map(
      ({ pluginName, path }) =>
        `<link rel="stylesheet" type="text/css" href="/plugin/${pluginName}/static/${path}">`,
    ),
  );

  // Extra data
  scripts.push(
    `<script nonce="INJECT_NONCE">window.__APP_DATA__ = { ROOT_URL: "${process.env.ROOT_URL}", CSRF_TOKEN: "${req.csrfToken()}" }</script>`,
  );

  return injectEndOfHead(html, scripts.join("\n")).replace(
    /INJECT_NONCE/g,
    req.res?.locals.nonce,
  );
}
