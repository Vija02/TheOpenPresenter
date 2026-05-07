import type { initTRPC } from "@trpc/server";

export type TRPCContext = Awaited<{
  userId: string | null;
}>;
export type TRPCObject = ReturnType<
  ReturnType<typeof initTRPC.context<TRPCContext>>["create"]
>;
