import { initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import { Express } from "express";

import { serverPluginApi } from "../pluginManager";

export default async function installTrpc(app: Express) {
  const createContext = ({
    req,
    res,
  }: trpcExpress.CreateExpressContextOptions) => ({}); // TODO:
  type Context = Awaited<ReturnType<typeof createContext>>;

  const t = initTRPC.context<Context>().create();
  const middleware = trpcExpress.createExpressMiddleware({
    router: t.mergeRouters(
      ...serverPluginApi.getRegisteredTrpcAppRouter().map((x) => x(t)),
    ),
  });

  app.use("/trpc", middleware);
}
