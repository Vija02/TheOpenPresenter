import { TRPCContext } from "@repo/base-plugin/server";
import { TRPCError, initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import { Express } from "express";

import { serverPluginApi } from "../pluginManager";
import { getRootPgPool } from "./installDatabasePools";

export default async function installTrpc(app: Express) {
  const createContext = async ({
    req,
    res,
  }: trpcExpress.CreateExpressContextOptions) => {
    const {
      rows: [{ user_id }],
    } = await getRootPgPool(app).query(
      "select user_id from app_private.sessions where uuid = $1",
      [req.user?.session_id],
    );

    if (!user_id) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    return {
      userId: user_id,
    };
  };

  const t = initTRPC.context<TRPCContext>().create();
  const middleware = trpcExpress.createExpressMiddleware({
    router: t.mergeRouters(
      ...serverPluginApi.getRegisteredTrpcAppRouter().map((x) => x(t)),
    ),
    createContext,
  });

  app.use("/trpc", middleware);
}
