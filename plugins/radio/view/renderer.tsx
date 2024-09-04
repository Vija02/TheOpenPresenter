import r2wc from "@r2wc/react-to-web-component";
import {
  AwarenessContext,
  ObjectToTypedMap,
  Plugin,
  PluginAPIProvider,
  PluginContext,
} from "@repo/base-plugin/client";
import type { TRPCUntypedClient } from "@trpc/client";

import { AppRouter } from "../src";
import { rendererWebComponentTag } from "../src/consts";
import Renderer from "./Renderer";

const RendererEntry = (props: {
  yjsPluginSceneData: ObjectToTypedMap<Plugin<any>>;
  yjsPluginRendererData: ObjectToTypedMap<any>;
  awarenessContext: AwarenessContext;
  pluginContext: PluginContext;
  setRenderCurrentScene: () => void;
  trpcClient: TRPCUntypedClient<AppRouter>;
}) => {
  return (
    <PluginAPIProvider {...props}>
      <Renderer />
    </PluginAPIProvider>
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
