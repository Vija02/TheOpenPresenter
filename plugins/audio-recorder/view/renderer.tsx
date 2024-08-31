import r2wc from "@r2wc/react-to-web-component";
import { AwarenessContext, PluginContext } from "@repo/base-plugin/client";
import type { TRPCUntypedClient } from "@trpc/client";
import { useEffect, useState } from "react";
import type { Map } from "yjs";

import { AppRouter } from "../src";
import { rendererWebComponentTag } from "../src/consts";
import { init } from "./pluginApi";
import { useAudioRecording } from "./useAudioRecording";

const RendererEntry = ({
  yjsPluginSceneData,
  yjsPluginRendererData,
  awarenessContext,
  pluginContext,
  setRenderCurrentScene,
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

  return <>{isInitialized && <AudioHandler />}</>;
};

const AudioHandler = () => {
  useAudioRecording();
  return null;
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
