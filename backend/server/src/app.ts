import express, { Express } from "express";
import { IncomingMessage, Server } from "http";
import { Middleware } from "postgraphile";
import { Duplex } from "stream";

import { cloudflareIps } from "./cloudflare";
import * as middleware from "./middleware";
import { initPlugins } from "./pluginManager";
import { ShutdownAction, makeShutdownActions } from "./shutdownActions";
import { sanitizeEnv } from "./utils";

// Server may not always be supplied, e.g. where mounting on a sub-route
export function getHttpServer(app: Express): Server | null {
  return app.get("httpServer") ?? null;
}

export function getShutdownActions(app: Express): ShutdownAction[] {
  return app.get("shutdownActions");
}

type UpgradeHandlers = Array<{
  name: string;
  check: (
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => boolean | Promise<boolean>;
  upgrade: (req: IncomingMessage, socket: Duplex, head: Buffer) => void;
}>;
export function getUpgradeHandlers(app: Express): UpgradeHandlers {
  return app.get("upgradeHandlers");
}

export function getWebsocketMiddlewares(
  app: Express,
): Middleware<express.Request, express.Response>[] {
  return app.get("websocketMiddlewares");
}

export async function makeApp({
  httpServer,
}: {
  httpServer?: Server;
} = {}): Promise<Express> {
  sanitizeEnv();

  const isTest = process.env.NODE_ENV === "test";
  const isDev = process.env.NODE_ENV === "development";

  const shutdownActions = makeShutdownActions();

  if (isDev) {
    shutdownActions.push(() => {
      require("inspector").close();
    });
  }

  /*
   * Our Express server
   */
  const app = express();

  await initPlugins(app);

  /*
   * In production, we may need to enable the 'trust proxy' setting so that the
   * server knows it's running in SSL mode, and so the logs can log the true
   * IP address of the client rather than the IP address of our proxy.
   */
  if (process.env.TRUST_PROXY) {
    /*
      We recommend you set TRUST_PROXY to the following:

        loopback,linklocal,uniquelocal

      followed by any other IPs you need to trust. For example for CloudFlare
      you can get the list of IPs from https://www.cloudflare.com/ips-v4; we
      have a script that does this for you (`yarn server cloudflare:import`)
      and a special `TRUST_PROXY=cloudflare` setting you can use to use them.
    */
    app.set(
      "trust proxy",
      process.env.TRUST_PROXY === "1"
        ? true
        : process.env.TRUST_PROXY === "cloudflare"
          ? ["loopback", "linklocal", "uniquelocal", ...cloudflareIps]
          : process.env.TRUST_PROXY.split(","),
    );
  }

  /*
   * Getting access to the HTTP server directly means that we can do things
   * with websockets if we need to (e.g. GraphQL subscriptions).
   */
  app.set("httpServer", httpServer);

  /*
   * For a clean nodemon shutdown, we need to close all our sockets otherwise
   * we might not come up cleanly again (inside nodemon).
   */
  app.set("shutdownActions", shutdownActions);

  /*
   * Since multiple things in our server might want to handle websockets and
   * this is handled in node via the 'upgrade' event which should have one handler
   * only, we need a centralised location to listen for upgrade events that then
   * decides which handler to dispatch the event to. This array stores these
   * handlers.
   */
  const upgradeHandlers: UpgradeHandlers = [];
  app.set("upgradeHandlers", upgradeHandlers);

  /*
   * When we're using websockets, we may want them to have access to
   * sessions/etc for authentication.
   */
  const websocketMiddlewares: Middleware<express.Request, express.Response>[] =
    [];
  app.set("websocketMiddlewares", websocketMiddlewares);

  /*
   * Middleware is installed from the /server/middleware directory. These
   * helpers may augment the express app with new settings and/or install
   * express middleware. These helpers may be asynchronous, but they should
   * operate very rapidly to enable quick as possible server startup.
   */
  await middleware.installDatabasePools(app);
  await middleware.installWorkerUtils(app);
  await middleware.installHelmet(app);
  await middleware.installSameOrigin(app);
  await middleware.installSession(app);
  await middleware.installCSRFProtection(app);
  await middleware.installPassport(app);
  await middleware.installLogging(app);
  await middleware.installObservability(app);
  await middleware.installAutoLogin(app);
  if (process.env.FORCE_SSL) {
    await middleware.installForceSSL(app);
  }
  await middleware.installPluginStatic(app);
  await middleware.installPluginRoute(app);
  // These are our assets: images/etc; served out of the /backend/server/public folder (if present)
  await middleware.installSharedStatic(app);
  if (isTest || isDev) {
    await middleware.installE2EServerCommand(app);
  }
  await middleware.installFileUpload(app);
  await middleware.installProjectImportExport(app);
  await middleware.installTrpc(app);
  await middleware.installPostGraphile(app);
  await middleware.installRemote(app, httpServer!);
  await middleware.installRenderer(app, httpServer!);
  await middleware.installSSR(app);
  await middleware.installHocuspocus(app);

  /*
   * Error handling middleware
   */
  await middleware.installErrorHandler(app);

  return app;
}
