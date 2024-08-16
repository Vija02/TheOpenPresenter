import type { AppRouter } from "@repo/plugin-myworshiplist";
import { createTRPCReact, httpBatchLink } from "@trpc/react-query";

import { getCSRFToken, getRootURL } from "../appData";

export const trpc = createTRPCReact<AppRouter>();
export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      // TODO: Auth
      url: getRootURL() + "/trpc",
      headers: {
        "csrf-token": getCSRFToken(),
      },
    }),
  ],
});
