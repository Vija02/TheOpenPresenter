import { TRPCContext } from "@repo/base-plugin/server";
import { TRPCError, initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import { Express } from "express";

import { serverPluginApi } from "../pluginManager";
import { getRootPgPool } from "./installDatabasePools";

export default async function installTrpc(app: Express) {
  const createContext = async ({
    req,
  }: trpcExpress.CreateExpressContextOptions): Promise<TRPCContext> => {
    const sessionId = req.user?.session_id ?? null;
    const screenGuestSessionId =
      (req.session as any)?.screenGuestSession?.id ?? null;

    let userId: string | null = null;
    if (sessionId) {
      const {
        rows: [row],
      } = await getRootPgPool(app).query(
        "select user_id from app_private.sessions where uuid = $1",
        [sessionId],
      );
      userId = row?.user_id ?? null;
    }

    if (!userId && !screenGuestSessionId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    return {
      userId,
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
