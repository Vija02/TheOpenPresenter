import type { AppRouter } from "@repo/plugin-myworshiplist";
import { createTRPCReact, httpBatchLink } from "@trpc/react-query";

export const trpc = createTRPCReact<AppRouter>();
export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      // TODO: Auth, prod url
      url: "http://localhost:5678/trpc",
    }),
  ],
});
