import { ChakraProvider } from "@chakra-ui/react";
import r2wc from "@r2wc/react-to-web-component";
import {
  AwarenessContext,
  ObjectToTypedMap,
  Plugin,
  PluginAPIProvider,
  PluginContext,
} from "@repo/base-plugin/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TRPCUntypedClient } from "@trpc/client";

import { AppRouter } from "../src";
import { remoteWebComponentTag } from "../src/consts";
import Remote from "./AudioRecorderRemote";
import { trpc } from "./trpc";

const queryClient = new QueryClient();

const RemoteEntry = (props: {
  yjsPluginSceneData: ObjectToTypedMap<Plugin<any>>;
  yjsPluginRendererData: ObjectToTypedMap<any>;
  awarenessContext: AwarenessContext;
  pluginContext: PluginContext;
  setRenderCurrentScene: () => void;
  trpcClient: TRPCUntypedClient<AppRouter>;
}) => {
  return (
    <PluginAPIProvider {...props}>
      <ChakraProvider resetCSS>
        <trpc.Provider client={props.trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <Remote />
          </QueryClientProvider>
        </trpc.Provider>
      </ChakraProvider>
    </PluginAPIProvider>
  );
};

const Component = r2wc(RemoteEntry, {
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
customElements.define(remoteWebComponentTag, Component);
