import { appData } from "@repo/lib";
import type { AppRouter } from "@repo/plugin-lyrics-presenter";
import { createTRPCReact, httpBatchLink } from "@trpc/react-query";

export const trpc = createTRPCReact<AppRouter>();
export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      // TODO: Auth
      url: window.location.origin + "/trpc",
      headers: {
        "csrf-token": appData.getCSRFToken(),
      },
    }),
  ],
});
