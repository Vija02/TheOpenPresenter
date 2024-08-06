import { ChakraProvider } from "@chakra-ui/react";
import r2wc from "@r2wc/react-to-web-component";
import { PluginDataProvider } from "@repo/base-plugin/client";
import type { TRPCUntypedClient } from "@trpc/client";
import type { Map } from "yjs";

import { AppRouter } from "../src";
import { rendererWebComponentTag } from "../src/consts";
import ImageRenderer from "./ImageRenderer";

const SimpleImageRendererEntry = ({
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
        <ImageRenderer />
      </PluginDataProvider>
    </ChakraProvider>
  );
};

const Component = r2wc(SimpleImageRendererEntry, {
  //@ts-ignore
  props: {
    yjsPluginSceneData: "",
    yjsPluginRendererData: "",
    setRenderCurrentScene: "",
    trpcClient: "",
  },
});
customElements.define(rendererWebComponentTag, Component);
