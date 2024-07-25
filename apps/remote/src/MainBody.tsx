import { Box, Text } from "@chakra-ui/react";
import type { Scene } from "@repo/base-plugin";
import React from "react";
import { Route, Switch } from "wouter";

import { trpcClient } from "./trpc";
import { getYJSPluginData, useData } from "./yjs";

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
  return (
    <>
      {Object.entries(value.children).map(([pluginId, pluginInfo]) => (
        <Box key={pluginId}>
          {/* TODO: Get data from backend */}
          {pluginInfo.plugin === "myworshiplist" ? (
            React.createElement("myworshiplist-remote", {
              yjsData: getYJSPluginData(sceneId, pluginId),
              trpcClient,
            })
          ) : (
            <Text>No renderer for {pluginInfo.plugin}</Text>
          )}
        </Box>
      ))}
    </>
  );
};

export default MainBody;
