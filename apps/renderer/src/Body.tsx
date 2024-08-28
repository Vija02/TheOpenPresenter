import { Box, Text } from "@chakra-ui/react";
import { AwarenessContext, Scene } from "@repo/base-plugin";
import React, { useMemo } from "react";

import { useData, usePluginData } from "./contexts/PluginDataProvider";
import { usePluginMetaData } from "./contexts/PluginMetaDataProvider";
import { trpcClient } from "./trpc";

export const Body = () => {
  const data = useData();

  const currentRenderer = useMemo(() => data.renderer["1"], [data.renderer]);
  const currentScene = useMemo(
    () => currentRenderer?.currentScene,
    [currentRenderer?.currentScene],
  );

  if (!currentScene) {
    return;
  }

  return (
    <>
      {Object.keys(currentRenderer?.children[currentScene] ?? {}).map(
        (pluginId) => (
          <PluginRenderer
            key={pluginId}
            pluginId={pluginId}
            currentScene={currentScene}
          />
        ),
      )}
    </>
  );
};

const PluginRenderer = React.memo(
  ({ pluginId, currentScene }: { pluginId: string; currentScene: string }) => {
    const pluginMetaData = usePluginMetaData().pluginMetaData;
    const {
      getYJSPluginRenderer,
      getYJSPluginRendererData,
      getYJSPluginSceneData,
      provider,
    } = usePluginData();
    const mainState = usePluginData().mainState!;

    const pluginInfo = useMemo(
      () => (mainState.data[currentScene] as Scene).children[pluginId],
      [currentScene, mainState.data, pluginId],
    );
    const tag = useMemo(
      () =>
        pluginMetaData?.pluginMeta.registeredRendererView.find(
          (x) => x.pluginName === pluginInfo?.plugin,
        )?.tag,
      [pluginInfo?.plugin, pluginMetaData?.pluginMeta.registeredRendererView],
    );

    const TagElement = useMemo(
      () =>
        tag ? (
          React.createElement(tag, {
            yjsPluginSceneData: getYJSPluginSceneData(currentScene, pluginId),
            yjsPluginRendererData: getYJSPluginRendererData(
              currentScene,
              pluginId,
            ),
            awarenessContext: {
              awarenessObj: provider?.awareness,
              currentUserId: "",
            } as AwarenessContext,
            pluginContext: { pluginId, sceneId: currentScene },
            setRenderCurrentScene: () => {
              getYJSPluginRenderer()?.set("currentScene", currentScene);
            },
            trpcClient,
          })
        ) : (
          <Text>No renderer for {pluginInfo?.plugin}</Text>
        ),
      [
        currentScene,
        getYJSPluginRenderer,
        getYJSPluginRendererData,
        getYJSPluginSceneData,
        pluginId,
        pluginInfo?.plugin,
        provider?.awareness,
        tag,
      ],
    );

    return <Box key={pluginId}>{TagElement}</Box>;
  },
);
