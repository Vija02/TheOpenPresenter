import { Box, Text } from "@chakra-ui/react";
import { Scene } from "@repo/base-plugin";
import React from "react";

import { usePluginMetaData } from "./contexts/PluginMetaDataProvider";
import { trpcClient } from "./trpc";
import {
  getYJSPluginRenderer,
  getYJSPluginRendererData,
  getYJSPluginSceneData,
  mainState,
  useData,
} from "./yjs";

export const Body = () => {
  const data = useData();

  const currentRenderer = data.renderer["1"];
  const currentScene = currentRenderer?.currentScene;
  const pluginMetaData = usePluginMetaData();
  
  if (!currentScene) {
    return;
  }

  return (
    <>
      {Object.keys(currentRenderer.children[currentScene] ?? {}).map(
        (pluginId) => {
          const pluginInfo = (mainState.data[currentScene] as Scene).children[
            pluginId
          ];
          const tag = pluginMetaData?.pluginMeta.registeredRendererView.find(
            (x) => x.pluginName === pluginInfo?.plugin,
          )?.tag;

          return (
            <Box key={pluginId}>
              {tag ? (
                React.createElement(tag, {
                  yjsPluginSceneData: getYJSPluginSceneData(
                    currentScene,
                    pluginId,
                  ),
                  yjsPluginRendererData: getYJSPluginRendererData(
                    currentScene,
                    pluginId,
                  ),
                  setRenderCurrentScene: () => {
                    getYJSPluginRenderer()?.set("currentScene", currentScene);
                  },
                  trpcClient,
                })
              ) : (
                <Text>No renderer for {pluginInfo?.plugin}</Text>
              )}
            </Box>
          );
        },
      )}
    </>
  );
};
