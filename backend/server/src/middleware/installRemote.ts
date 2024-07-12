import { Express } from "express";
import { Server } from "http";
import ViteExpress from "vite-express";

export default async function installRemote(app: Express, server: Server) {
  ViteExpress.config({
    mode: process.env.NODE_ENV === "production" ? "production" : "development",
    inlineViteConfig: {
      root: `${__dirname}/../../../../apps/remote`,
      base: "/app",
      build: { outDir: "out" },
    },
  });
  await ViteExpress.bind(app, server);
}
