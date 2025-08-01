import { Express, Request } from "express";
import { Server, createServer } from "http";
import serialize from "serialize-javascript";
import type { UserConfig } from "vite";
import { ViteExpress } from "vite-express";

import { getUpgradeHandlers } from "../app";
import { injectEndOfHead } from "../utils/injectHtml";
import { DEV_NONCE } from "./shared";

// Hardcoded, so we'll want to make sure this is always up to date
const paths = [
  "/invitations",
  "/o",
  "/org",
  "/settings",
  "/forgot",
  "/login",
  "/register",
  "/reset",
  "/verify",
];

export default async function installProjectManagement(
  app: Express,
  server: Server,
) {
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
      root: `${__dirname}/../../../apps/project`,
      // Handle on these paths for express
      expressBase: paths,
      // We need this base to match one of the paths for asset serving. Otherwise, if we pass /, it'll be served on the root path.
      base: "/o",
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
      name: "Project Management Handler",
      check(req) {
        return paths.some((x) => req.url?.startsWith(x));
      },
      upgrade: upgradeHandler,
    });
  }
}

function transformer(html: string, req: Request) {
  const scripts = [];

  // Extra data
  const extraEnv = [
    {
      ROOT_URL: process.env.ROOT_URL,
      CSRF_TOKEN: req.csrfToken(),
      MEDIA_UPLOAD_CHUNK_SIZE: process.env.MEDIA_UPLOAD_CHUNK_SIZE,
      ENABLE_OTEL: !!process.env.OTLP_HOST ? "1" : undefined,
    } as Record<string, string>,
  ].reduce((acc, val) => ({ ...acc, ...val }), {} as Record<string, string>);

  scripts.push(
    `<script nonce="INJECT_NONCE">window.__APP_DATA__ = ${serialize({ ...extraEnv })}</script>`,
  );

  return injectEndOfHead(html, scripts.join("\n")).replace(
    /INJECT_NONCE/g,
    req.res?.locals.nonce,
  );
}
