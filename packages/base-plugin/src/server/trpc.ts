import { TRPCError } from "@trpc/server";

import type { TRPCBase, TRPCObject } from "./types";

export const createPluginTRPCObject = (tBase: TRPCBase): TRPCObject => {
  const enforceAuth = tBase.middleware(({ ctx, next }) => {
    if (!ctx.userId && !ctx.screenGuestSessionId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next();
  });

  return {
    ...tBase,
    procedure: tBase.procedure.use(enforceAuth),
    publicProcedure: tBase.procedure,
  } as TRPCObject;
};
