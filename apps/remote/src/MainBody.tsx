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
          .map(([id, value]) => (
            <Route key={id} path={`/${id}`}>
              <PluginRenderer id={id} value={value as Scene} />
            </Route>
          ))}
      </Switch>
    </Box>
  );
};

const PluginRenderer = ({ id, value }: { id: string; value: Scene }) => {
  return (
    <>
      {/* TODO: Get data from backend */}
      {value.plugin === "myworshiplist" ? (
        React.createElement("myworshiplist-remote", {
          yjsData: getYJSPluginData(id),
          trpcClient,
        })
      ) : (
        <Text>No renderer for {value.plugin}</Text>
      )}
    </>
  );
};

export default MainBody;
