import {
  createInvokeCapability,
  createSseRoute,
  organizationIdOf,
  withoutOrganizationId,
} from "@repo/base-plugin/server";
import { Express, RequestHandler } from "express";

import { registerBuiltInAiCapabilities } from "../ai";
import { serverPluginApi } from "../pluginManager";

export default (app: Express) => {
  registerBuiltInAiCapabilities(serverPluginApi);

  const capabilities = serverPluginApi.getRegisteredAiCapabilities();
  const registry = { get: (id: string) => capabilities.get(id) };

  const routes = new Map<string, RequestHandler>();
  for (const [id, capability] of capabilities) {
    routes.set(
      id,
      createSseRoute({
        name: `ai/${id}`,
        parse: (raw) => ({ raw, input: capability.parse(raw) }),
        handler: ({ body: { raw, input }, signal, req }) =>
          serverPluginApi.ai.run(req, {
            organizationId: organizationIdOf(raw),
            signal,
            cloudPath: `/ai/${id}`,
            body: withoutOrganizationId(raw),
            // A request off the wire is the root of any spawn tree: depth 0
            local: () =>
              capability.handler({
                body: input,
                signal,
                depth: 0,
                invokeCapability: createInvokeCapability(registry, signal, 0),
              }),
          }),
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
