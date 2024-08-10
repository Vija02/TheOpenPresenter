import { ChakraProvider } from "@chakra-ui/react";
import r2wc from "@r2wc/react-to-web-component";
import { PluginContext, PluginDataProvider } from "@repo/base-plugin/client";
import type { TRPCUntypedClient } from "@trpc/client";
import type { Map } from "yjs";

import { AppRouter } from "../src";
import { rendererWebComponentTag } from "../src/consts";
import Renderer from "./Renderer";

const RendererEntry = ({
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
        <Renderer />
      </PluginDataProvider>
    </ChakraProvider>
  );
};

const Component = r2wc(RendererEntry, {
  //@ts-ignore
  props: {
    yjsPluginSceneData: "",
    yjsPluginRendererData: "",
    pluginContext: "",
    setRenderCurrentScene: "",
    trpcClient: "",
  },
});
customElements.define(rendererWebComponentTag, Component);
