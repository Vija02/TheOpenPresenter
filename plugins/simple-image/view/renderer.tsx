import { ChakraProvider } from "@chakra-ui/react";
import r2wc from "@r2wc/react-to-web-component";
import { AwarenessContext, PluginContext } from "@repo/base-plugin/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TRPCUntypedClient } from "@trpc/client";
import { useEffect, useState } from "react";
import type { Map } from "yjs";

import { AppRouter } from "../src";
import { rendererWebComponentTag } from "../src/consts";
import Renderer from "./ImageRenderer";
import { init } from "./pluginApi";
import { trpc } from "./trpc";

const queryClient = new QueryClient();

const RendererEntry = ({
  yjsPluginSceneData,
  yjsPluginRendererData,
  awarenessContext,
  pluginContext,
  setRenderCurrentScene,
  trpcClient,
}: {
  yjsPluginSceneData: Map<any>;
  yjsPluginRendererData: Map<any>;
  awarenessContext: AwarenessContext;
  pluginContext: PluginContext;
  setRenderCurrentScene: () => void;
  trpcClient: TRPCUntypedClient<AppRouter>;
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  useEffect(() => {
    init({
      yjsPluginSceneData,
      yjsPluginRendererData,
      awarenessContext,
      pluginContext,
      setRenderCurrentScene,
    });
    setIsInitialized(true);
  }, [
    awarenessContext,
    pluginContext,
    setRenderCurrentScene,
    yjsPluginRendererData,
    yjsPluginSceneData,
  ]);

  return (
    <ChakraProvider resetCSS>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {isInitialized && <Renderer />}
        </QueryClientProvider>
      </trpc.Provider>
    </ChakraProvider>
  );
};

const Component = r2wc(RendererEntry, {
  //@ts-ignore
  props: {
    yjsPluginSceneData: "",
    yjsPluginRendererData: "",
    awarenessContext: "",
    pluginContext: "",
    setRenderCurrentScene: "",
    trpcClient: "",
  },
});
customElements.define(rendererWebComponentTag, Component);
