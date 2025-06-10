import { PluginAPIProvider, WebComponentProps } from "@repo/base-plugin/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TRPCUntypedClient } from "@trpc/client";

import { AppRouter } from "../../src";
import Remote from "../Remote";
import { trpc } from "../trpc";

const queryClient = new QueryClient();

export default function RemoteEntry(
  props: WebComponentProps<TRPCUntypedClient<AppRouter>>,
) {
  return (
    <PluginAPIProvider {...props}>
      <trpc.Provider client={props.trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <Remote />
        </QueryClientProvider>
      </trpc.Provider>
    </PluginAPIProvider>
  );
}
