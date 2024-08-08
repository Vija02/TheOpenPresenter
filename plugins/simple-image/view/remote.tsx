import { ChakraProvider } from "@chakra-ui/react";
import r2wc from "@r2wc/react-to-web-component";
import { PluginContext, PluginDataProvider } from "@repo/base-plugin/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TRPCUntypedClient } from "@trpc/client";
import "@uppy/core/dist/style.min.css";
import "@uppy/file-input/dist/style.css";
import "@uppy/status-bar/dist/style.min.css";
import type { Map } from "yjs";

import { AppRouter } from "../src";
import { remoteWebComponentTag } from "../src/consts";
import ImageRemote from "./ImageRemote";
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
            <ImageRemote />
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
