import { Box, Text } from "@chakra-ui/react";
import type { Scene } from "@repo/base-plugin";
import { useBasePluginQuery } from "@repo/graphql";
import React from "react";
import { Route, Switch } from "wouter";

import { trpcClient } from "./trpc";
import {
  getYJSPluginRenderer,
  getYJSPluginRendererData,
  getYJSPluginSceneData,
  useData,
} from "./yjs";

const MainBody = () => {
  const data = useData();

  return (
    <Box>
      <Switch>
        {Object.entries(data.data)
          .filter(([, value]) => value.type === "scene")
          .map(([sceneId, value]) => (
            <Route key={sceneId} path={`/${sceneId}`}>
              <PluginRenderer sceneId={sceneId} value={value as Scene} />
            </Route>
          ))}
      </Switch>
    </Box>
  );
};

const PluginRenderer = ({
  sceneId,
  value,
}: {
  sceneId: string;
  value: Scene;
}) => {
  const { data: pluginData } = useBasePluginQuery();

  return (
    <>
      {Object.entries(value.children).map(([pluginId, pluginInfo]) => {
        const tag = pluginData?.pluginMeta.registeredView.find(
          (x) => x.pluginName === pluginInfo.plugin,
        )?.tag;

        return (
          <Box key={pluginId}>
            {tag ? (
              React.createElement(tag, {
                yjsPluginSceneData: getYJSPluginSceneData(sceneId, pluginId),
                yjsPluginRendererData: getYJSPluginRendererData(
                  sceneId,
                  pluginId,
                ),
                setRenderCurrentScene: () => {
                  getYJSPluginRenderer()?.set("currentScene", sceneId);
                },
                trpcClient,
              })
            ) : (
              <Text>No renderer for {pluginInfo.plugin}</Text>
            )}
          </Box>
        );
      })}
    </>
  );
};

export default MainBody;
