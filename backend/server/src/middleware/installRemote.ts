import { Express, Request } from "express";
import { Server, createServer } from "http";
import ViteExpress from "vite-express";

import { getUpgradeHandlers } from "../app";
import { serverPluginApi } from "../pluginManager";

export default async function installRemote(app: Express, server: Server) {
  const fakeHttpServer = createServer();

  ViteExpress.config({
    mode: process.env.NODE_ENV === "production" ? "production" : "development",
    inlineViteConfig: {
      root: `${__dirname}/../../../../apps/remote`,
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
  await ViteExpress.bind(app, server);

  const upgradeHandler = fakeHttpServer.listeners("upgrade")[0] as any;
  if (upgradeHandler) {
    const upgradeHandlers = getUpgradeHandlers(app);
    upgradeHandlers.push({
      name: "Remote Hander",
      check(req) {
        return (req.url === "/app" || req.url?.startsWith("/app")) ?? false;
      },
      upgrade: upgradeHandler,
    });
  }
}

function transformer(html: string, _req: Request) {
  const registeredLoadJsOnRemoteView =
    serverPluginApi.getRegisteredLoadJsOnRemoteView();

  // Load all the JS from plugins
  return html.replace(
    "<!-- injection point -->",
    registeredLoadJsOnRemoteView
      .map(
        ({ pluginName, path }) =>
          `<script type="module" src="/plugin/${pluginName}/${path}"></script>`,
      )
      .join("\n"),
  );
}
