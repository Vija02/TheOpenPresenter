import { ChakraProvider } from "@chakra-ui/react";
import { PluginAPIProvider, WebComponentProps } from "@repo/base-plugin/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TRPCUntypedClient } from "@trpc/client";

import { AppRouter } from "../../src";
import Renderer from "../MWLRenderer";
import { trpc } from "../trpc";

const queryClient = new QueryClient();

export default function RendererEntry(
  props: WebComponentProps<TRPCUntypedClient<AppRouter>>,
) {
  return (
    <PluginAPIProvider {...props}>
      <ChakraProvider resetCSS>
        <trpc.Provider client={props.trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <Renderer />
          </QueryClientProvider>
        </trpc.Provider>
      </ChakraProvider>
    </PluginAPIProvider>
  );
}
