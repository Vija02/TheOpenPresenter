import { Box, Text } from "@chakra-ui/react";
import type { Scene } from "@repo/base-plugin";
import { Plugin } from "@repo/base-plugin";
import { useKeyPressMutation } from "@repo/graphql";
import React, { useMemo } from "react";
import { Route, Switch } from "wouter";

import { useData, usePluginData } from "../contexts/PluginDataProvider";
import { usePluginMetaData } from "../contexts/PluginMetaDataProvider";
import { trpcClient } from "../trpc";

const MainBody = () => {
  const data = useData();
  const [keyPressMutate] = useKeyPressMutation();
  const projectId = usePluginMetaData().projectId;

  return (
    <Box
      width="100%"
      overflow="auto"
      tabIndex={0}
      onKeyDown={(e) => {
        if (
          e.key === "ArrowUp" ||
          e.key === "ArrowDown" ||
          e.key === "ArrowRight" ||
          e.key === "ArrowLeft"
        )
          keyPressMutate({
            variables: {
              keyType:
                e.key === "ArrowRight" || e.key === "ArrowDown"
                  ? "NEXT"
                  : "PREV",
              projectId: projectId,
              // TODO:
              rendererId: "1",
            },
          });
      }}
    >
      <Switch>
        {Object.entries(data.data)
          .filter(([, value]) => value.type === "scene")
          .map(([sceneId, value]) => (
            <Route nest key={sceneId} path={`/${sceneId}`}>
              <SceneRenderer sceneId={sceneId} value={value as Scene} />
            </Route>
          ))}
      </Switch>
    </Box>
  );
};

const SceneRenderer = React.memo(
  ({ sceneId, value }: { sceneId: string; value: Scene }) => {
    return (
      <>
        {Object.entries(value.children).map(([pluginId, pluginInfo]) => (
          <PluginRenderer
            key={pluginId}
            sceneId={sceneId}
            pluginId={pluginId}
            pluginInfo={pluginInfo}
          />
        ))}
      </>
    );
  },
);

const PluginRenderer = React.memo(
  ({
    sceneId,
    pluginId,
    pluginInfo,
  }: {
    sceneId: string;
    pluginId: string;
    pluginInfo: Plugin<Record<string, any>>;
  }) => {
    const pluginMetaData = usePluginMetaData().pluginMetaData;
    const {
      getYJSPluginRenderer,
      getYJSPluginRendererData,
      getYJSPluginSceneData,
    } = usePluginData();

    const tag = useMemo(
      () =>
        pluginMetaData?.pluginMeta.registeredRemoteView.find(
          (x) => x.pluginName === pluginInfo.plugin,
        )?.tag,
      [pluginInfo.plugin, pluginMetaData?.pluginMeta.registeredRemoteView],
    );

    const Element = useMemo(() => {
      return tag ? (
        React.createElement(tag, {
          yjsPluginSceneData: getYJSPluginSceneData(sceneId, pluginId),
          yjsPluginRendererData: getYJSPluginRendererData(sceneId, pluginId),
          pluginContext: { pluginId, sceneId },
          setRenderCurrentScene: () => {
            getYJSPluginRenderer()?.set("currentScene", sceneId);
          },
          trpcClient,
        })
      ) : (
        <Text>No renderer for {pluginInfo.plugin}</Text>
      );
    }, [
      getYJSPluginRenderer,
      getYJSPluginRendererData,
      getYJSPluginSceneData,
      pluginId,
      pluginInfo.plugin,
      sceneId,
      tag,
    ]);

    return <Box>{Element}</Box>;
  },
);

export default MainBody;