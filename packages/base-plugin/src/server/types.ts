import type { initTRPC } from "@trpc/server";

export type TRPCContext = Awaited<{
  userId: string | null;
  sessionId: string | null;
  screenGuestSessionId: string | null;
}>;

/** A plain tRPC instance, before the plugin-facing auth defaults are applied. */
export type TRPCBase = ReturnType<
  ReturnType<typeof initTRPC.context<TRPCContext>>["create"]
>;

export type TRPCObject = TRPCBase & {
  publicProcedure: TRPCBase["procedure"];
};
