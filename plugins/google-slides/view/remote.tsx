import { ChakraProvider } from "@chakra-ui/react";
import r2wc from "@r2wc/react-to-web-component";
import { PluginContext, PluginDataProvider } from "@repo/base-plugin/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TRPCUntypedClient } from "@trpc/client";
import type { Map } from "yjs";

import { AppRouter } from "../src";
import { remoteWebComponentTag } from "../src/consts";
import Remote from "./Remote";
import { trpc } from "./trpc";

const queryClient = new QueryClient();

const RemoteEntry = ({
  yjsPluginSceneData,
  yjsPluginRendererData,
  pluginContext,
  setRenderCurrentScene,
  trpcClient,
}: {
  yjsPluginSceneData: Map<any>;
  yjsPluginRendererData: Map<any>;
  pluginContext: PluginContext;
  setRenderCurrentScene: () => void;
  trpcClient: TRPCUntypedClient<AppRouter>;
}) => {
  return (
    <ChakraProvider resetCSS>
      <PluginDataProvider
        yjsPluginSceneData={yjsPluginSceneData}
        yjsPluginRendererData={yjsPluginRendererData}
        pluginContext={pluginContext}
        setRenderCurrentScene={setRenderCurrentScene}
      >
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <Remote />
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
    pluginContext: "",
    setRenderCurrentScene: "",
    trpcClient: "",
  },
});
customElements.define(remoteWebComponentTag, Component);
