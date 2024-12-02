import { ChakraProvider } from "@chakra-ui/react";
import { PluginAPIProvider, WebComponentProps } from "@repo/base-plugin/client";
import { theme } from "@repo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TRPCUntypedClient } from "@trpc/client";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";

import { AppRouter } from "../../src";
import Remote from "../ImageRemote";
import { trpc } from "../trpc";

const queryClient = new QueryClient();

export default function RemoteEntry(
  props: WebComponentProps<TRPCUntypedClient<AppRouter>>,
) {
  return (
    <PluginAPIProvider {...props}>
      <ChakraProvider theme={theme} resetCSS>
        <trpc.Provider client={props.trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <Remote />
          </QueryClientProvider>
        </trpc.Provider>
      </ChakraProvider>
    </PluginAPIProvider>
  );
}
