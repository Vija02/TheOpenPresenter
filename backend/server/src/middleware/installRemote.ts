import { Express, Request } from "express";
import { Server, createServer } from "http";
import serialize from "serialize-javascript";
import type { UserConfig } from "vite";
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
      envDir: `${__dirname}/../../../`,
      server: {
        hmr: {
          server: fakeHttpServer,
        },
      },
    } as Partial<UserConfig> &
      InstanceType<typeof ViteExpress>["_State"]["viteConfig"],
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

  const pluginNames = registeredLoadJsOnRemoteView
    .concat(registeredLoadCssOnRemoteView)
    .map((x) => x.pluginName);

  const pluginData = Object.fromEntries(
    pluginNames.map((pluginName) => [
      pluginName,
      {
        scripts: registeredLoadJsOnRemoteView
          .filter((x) => x.pluginName === pluginName)
          .map((x) => `/plugin/${pluginName}/static/${x.path}`),
        css: registeredLoadCssOnRemoteView
          .filter((x) => x.pluginName === pluginName)
          .map((x) => `/plugin/${pluginName}/static/${x.path}`),
      },
    ]),
  );

  // Extra data
  const extraEnv = [
    {
      ROOT_URL: process.env.ROOT_URL,
      CSRF_TOKEN: req.csrfToken(),
      MEDIA_UPLOAD_CHUNK_SIZE: process.env.MEDIA_UPLOAD_CHUNK_SIZE,
      ENABLE_OTEL: !!process.env.OTLP_HOST ? "1" : undefined,
    } as Record<string, string>,
  ]
    .concat(registeredEnvToViews.map((x) => x.envVars))
    .reduce((acc, val) => ({ ...acc, ...val }), {} as Record<string, string>);

  scripts.push(
    `<script nonce="INJECT_NONCE">window.__APP_DATA__ = ${serialize({ ...extraEnv, pluginData })}</script>`,
  );

  return injectEndOfHead(html, scripts.join("\n")).replace(
    /INJECT_NONCE/g,
    req.res?.locals.nonce,
  );
}
