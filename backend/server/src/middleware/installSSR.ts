import { Express } from "express";
import fs from "fs/promises";
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

  // Pages are built as `<page>/index.html` but their canonical URL has no
  // trailing slash (Astro `trailingSlash: "never"`), so serve that URL directly
  // and redirect the slash form to it, rather than the other way round
  app.use(async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }

    const pagePath = req.path.replace(/\/+$/, "");
    if (!pagePath) {
      return next();
    }

    const pageFile = await resolvePageFile(distPath, pagePath);
    if (!pageFile) {
      return next();
    }

    if (pagePath !== req.path) {
      const queryIndex = req.originalUrl.indexOf("?");
      const query = queryIndex === -1 ? "" : req.originalUrl.slice(queryIndex);
      return res.redirect(301, pagePath + query);
    }

    res.sendFile(pageFile);
  });

  app.use(express.default.static(distPath, { redirect: false }));
}

async function resolvePageFile(distPath: string, pagePath: string) {
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(pagePath);
  } catch {
    return null;
  }

  const file = path.join(distPath, decodedPath, "index.html");
  if (!file.startsWith(distPath + path.sep)) {
    return null;
  }

  try {
    const stat = await fs.stat(file);
    return stat.isFile() ? file : null;
  } catch {
    return null;
  }
}
