import { ChakraProvider } from "@chakra-ui/react";
import r2wc from "@r2wc/react-to-web-component";
import { PluginDataProvider } from "@repo/base-plugin/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TRPCUntypedClient } from "@trpc/client";
import type { Map } from "yjs";

import { AppRouter } from "../src";
import MWLRemote from "./MWLRemote";
import { trpc } from "./trpc";

const queryClient = new QueryClient();

const MyWorshipListEntry = ({
  yjsData,
  trpcClient,
}: {
  yjsData: Map<any>;
  trpcClient: TRPCUntypedClient<AppRouter>;
}) => {
  return (
    <ChakraProvider resetCSS>
      <PluginDataProvider yjsData={yjsData}>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <MWLRemote />
          </QueryClientProvider>
        </trpc.Provider>
      </PluginDataProvider>
    </ChakraProvider>
  );
};

const Component = r2wc(MyWorshipListEntry, {
  //@ts-ignore
  props: { yjsData: "", trpcClient: "" },
});
customElements.define("myworshiplist-remote", Component);
