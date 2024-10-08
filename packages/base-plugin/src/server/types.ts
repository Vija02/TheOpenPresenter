import type { initTRPC } from "@trpc/server";

export type TRPCContext = Awaited<{ userId: string }>;
export type TRPCObject = ReturnType<
  ReturnType<typeof initTRPC.context<TRPCContext>>["create"]
>;
