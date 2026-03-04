import { Express } from "express";
import { createServer } from "http";
import path from "path";

import { getUpgradeHandlers } from "../app";

if (!process.env.NODE_ENV) {
  throw new Error("No NODE_ENV envvar! Try `export NODE_ENV=development`");
}

const isDev = process.env.NODE_ENV === "development";

const HOMEPAGE_ASTRO_DIR = path.resolve(
  __dirname,
  "../../../apps/homepage",
);

export default async function installSSR(app: Express) {
  if (isDev) {
    await installAstroDev(app);
  } else {
    await installAstroProd(app);
  }
}

async function installAstroDev(app: Express) {
  const { dev } = await import("astro");

  const fakeHttpServer = createServer();

  const devServer = await dev({
    vite: { server: { hmr: { server: fakeHttpServer } } },
    root: HOMEPAGE_ASTRO_DIR,
    logLevel: "warn",
  });

  const upgradeHandler = fakeHttpServer.listeners("upgrade")[0] as any;
  if (upgradeHandler) {
    const upgradeHandlers = getUpgradeHandlers(app);
    upgradeHandlers.push({
      name: "Homepage Handler",
      check(req) {
        return (req.url === "/" || req.url?.startsWith("/")) ?? false;
      },
      upgrade: upgradeHandler,
    });
  }

  app.use((req, res) => {
    devServer.handle(req, res);
  });
}

async function installAstroProd(app: Express) {
  const distPath = path.join(HOMEPAGE_ASTRO_DIR, "dist");

  const express = await import("express");
  app.use(express.default.static(distPath));
}
