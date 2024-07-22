import { Express, Request } from "express";
import { Server } from "http";
import ViteExpress from "vite-express";

import { serverPluginApi } from "../pluginManager";

export default async function installRemote(app: Express, server: Server) {
  ViteExpress.config({
    mode: process.env.NODE_ENV === "production" ? "production" : "development",
    inlineViteConfig: {
      root: `${__dirname}/../../../../apps/remote`,
      base: "/app",
      build: { outDir: "dist" },
    },
    transformer,
  });
  await ViteExpress.bind(app, server);
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
