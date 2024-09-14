import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import type { AwarenessContext, PluginContext, Scene } from "@repo/base-plugin";
import { Plugin } from "@repo/base-plugin";
import { useKeyPressMutation } from "@repo/graphql";
import React, { useMemo } from "react";
import { Route, Switch } from "wouter";

import { useData, usePluginData } from "../contexts/PluginDataProvider";
import { usePluginMetaData } from "../contexts/PluginMetaDataProvider";
import { trpcClient } from "../trpc";

const MainBody = () => {
  const data = useData();
  const mainState = usePluginData().mainState!;
  const [keyPressMutate] = useKeyPressMutation();
  const projectId = usePluginMetaData().projectId;

  return (
    <Box
      width="100%"
      overflow="auto"
      tabIndex={0}
      onKeyDown={(e) => {
        // TODO: Expand on this functionality
        const keysToDetect = [
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
        ];
        if (keysToDetect.includes(e.key)) {
          keyPressMutate({
            variables: {
              keyType:
                e.key === "ArrowRight" ||
                e.key === "ArrowDown" ||
                e.key === "PageDown"
                  ? "NEXT"
                  : "PREV",
              projectId: projectId,
              // TODO:
              rendererId: "1",
            },
          });
          e.preventDefault();
        }
      }}
    >
      <Flex
        height="40px"
        boxShadow="md"
        alignItems="center"
        justifyContent="flex-end"
      >
        <Stack direction="row" p={2}>
          <Button
            size="sm"
            rounded="none"
            {...(data.renderer["1"]!.overlay &&
            data.renderer["1"]!.overlay.type === "black"
              ? {
                  border: "2px solid #ff6464",
                  animation: "blink 1.5s steps(1, end) infinite",
                }
              : { border: "2px solid transparent" })}
            onClick={() => {
              if (mainState.renderer["1"]!.overlay?.type === "black") {
                mainState.renderer["1"]!.overlay = null;
              } else {
                mainState.renderer["1"]!.overlay = { type: "black" };
              }
            }}
          >
            Black
          </Button>
          <Button
            size="sm"
            rounded="none"
            onClick={() => {
              mainState.renderer["1"]!.overlay = null;
            }}
          >
            Clear
          </Button>
        </Stack>
      </Flex>
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
      provider,
      currentUserId,
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
          awarenessContext: {
            awarenessObj: provider?.awareness,
            currentUserId,
          } as AwarenessContext,
          pluginContext: { pluginId, sceneId } as PluginContext,
          setRenderCurrentScene: () => {
            getYJSPluginRenderer()?.set("currentScene", sceneId);
          },
          trpcClient,
        })
      ) : (
        <Text>No renderer for {pluginInfo.plugin}</Text>
      );
    }, [
      currentUserId,
      getYJSPluginRenderer,
      getYJSPluginRendererData,
      getYJSPluginSceneData,
      pluginId,
      pluginInfo.plugin,
      provider?.awareness,
      sceneId,
      tag,
    ]);

    return <Box>{Element}</Box>;
  },
);

export default MainBody;
