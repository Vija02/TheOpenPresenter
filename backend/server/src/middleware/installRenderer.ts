import { Express, Request } from "express";
import { Server, createServer } from "http";
import ViteExpress from "vite-express";

import { getUpgradeHandlers } from "../app";
import { serverPluginApi } from "../pluginManager";

export default async function installRenderer(app: Express, server: Server) {
  const fakeHttpServer = createServer();
  const viteExpress = new ViteExpress();

  viteExpress.config({
    mode: process.env.NODE_ENV === "production" ? "production" : "development",
    inlineViteConfig: {
      root: `${__dirname}/../../../../apps/renderer`,
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

function transformer(html: string, _req: Request) {
  const registeredLoadJsOnRendererView =
    serverPluginApi.getRegisteredLoadJsOnRendererView();
  const registeredLoadCssOnRendererView =
    serverPluginApi.getRegisteredLoadCssOnRendererView();

  // Load all file from plugins
  return html.replace(
    "<!-- injection point -->",
    registeredLoadJsOnRendererView
      .map(
        ({ pluginName, path }) =>
          `<script type="module" src="/plugin/${pluginName}/static/${path}"></script>`,
      )
      .concat(
        registeredLoadCssOnRendererView.map(
          ({ pluginName, path }) =>
            `<link rel="stylesheet" type="text/css" href="/plugin/${pluginName}/static/${path}">`,
        ),
      )
      .join("\n"),
  );
}
