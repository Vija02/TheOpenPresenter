import { createTRPCReact } from "@trpc/react-query";

import { AppRouter } from "../src";

export const trpc = createTRPCReact<AppRouter>();
