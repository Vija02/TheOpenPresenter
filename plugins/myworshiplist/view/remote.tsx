import { ChakraProvider } from "@chakra-ui/react";
import r2wc from "@r2wc/react-to-web-component";
import { PluginDataProvider } from "@repo/base-plugin/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TRPCUntypedClient } from "@trpc/client";
import type { Map } from "yjs";

import { AppRouter } from "../src";
import { remoteWebComponentTag } from "../src/consts";
import MWLRemote from "./MWLRemote";
import { trpc } from "./trpc";

const queryClient = new QueryClient();

const RemoteEntry = ({
  yjsPluginSceneData,
  yjsPluginRendererData,
  setRenderCurrentScene,
  trpcClient,
}: {
  yjsPluginSceneData: Map<any>;
  yjsPluginRendererData: Map<any>;
  setRenderCurrentScene: () => void;
  trpcClient: TRPCUntypedClient<AppRouter>;
}) => {
  return (
    <ChakraProvider resetCSS>
      <PluginDataProvider
        yjsPluginSceneData={yjsPluginSceneData}
        yjsPluginRendererData={yjsPluginRendererData}
        setRenderCurrentScene={setRenderCurrentScene}
      >
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <MWLRemote />
          </QueryClientProvider>
        </trpc.Provider>
      </PluginDataProvider>
    </ChakraProvider>
  );
};

const Component = r2wc(RemoteEntry, {
  //@ts-ignore
  props: {
    yjsPluginSceneData: "",
    yjsPluginRendererData: "",
    setRenderCurrentScene: "",
    trpcClient: "",
  },
});
customElements.define(remoteWebComponentTag, Component);
