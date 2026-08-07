import { createSseRoute } from "@repo/base-plugin/server";
import { Express, RequestHandler } from "express";

import { registerBuiltInAiCapabilities } from "../ai";
import { serverPluginApi } from "../pluginManager";

export default (app: Express) => {
  registerBuiltInAiCapabilities(serverPluginApi);

  const capabilities = serverPluginApi.getRegisteredAiCapabilities();

  const routes = new Map<string, RequestHandler>();
  for (const [id, capability] of capabilities) {
    routes.set(
      id,
      createSseRoute({
        name: `ai/${id}`,
        parse: capability.parse,
        handler: capability.handler,
        ...(capability.maxBodyBytes !== undefined
          ? { maxBodyBytes: capability.maxBodyBytes }
          : {}),
      }),
    );
  }

  app.use("/ai/:capability", (req, res, next) => {
    const route = routes.get(req.params.capability!);
    if (!route) return next();
    route(req, res, next);
  });
};
