import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import {
  AwarenessContext,
  Plugin,
  PluginContext,
  Scene,
  State,
  YjsWatcher,
} from "@repo/base-plugin";
import { useKeyPressMutation } from "@repo/graphql";
import { useDisposable } from "@repo/lib";
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import Y from "yjs";

import { useData, usePluginData } from "../contexts/PluginDataProvider";
import { usePluginMetaData } from "../contexts/PluginMetaDataProvider";
import { trpcClient } from "../trpc";

const MainBody = () => {
  const [, navigate] = useLocation();

  const data = useData();
  const mainState = usePluginData().mainState!;
  const [keyPressMutate] = useKeyPressMutation();
  const projectId = usePluginMetaData().projectId;

  // On load, select the scene that is active if available
  useEffect(() => {
    const currentScene = mainState.renderer["1"]?.currentScene;
    if (currentScene) {
      navigate(`/${currentScene}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box
      width="100%"
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
      <Box height="calc(100vh - 40px)" overflow="auto">
        {Object.entries(data.data)
          .filter(([, value]) => value.type === "scene")
          .map(([sceneId, value]) => (
            <SceneRenderer
              key={sceneId}
              sceneId={sceneId}
              value={value as Scene}
            />
          ))}
      </Box>
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
    const orgId = usePluginMetaData().orgId;
    const {
      getYJSPluginRenderer,
      getYJSPluginSceneData,
      provider,
      mainYMap,
      currentUserId,
    } = usePluginData();

    const yjsWatcher = useDisposable(() => {
      const watcher = new YjsWatcher(mainYMap! as Y.Map<any>);
      return [watcher, () => watcher.dispose()];
    }, [mainYMap]);

    const [yjsPluginSceneData] = useState(
      getYJSPluginSceneData(sceneId, pluginId),
    );

    // Renderer is added through the server and requires an extra update. So we use a watcher here
    const yjsPluginRendererData = yjsWatcher?.useYjs<any>(
      (x: State) => x.renderer?.[1]?.children?.[sceneId]?.[pluginId],
    );

    const [match] = useRoute(`/${sceneId}`);

    const viewData = useMemo(
      () =>
        pluginMetaData?.pluginMeta.registeredRemoteView.find(
          (x) => x.pluginName === pluginInfo.plugin,
        ),
      [pluginInfo.plugin, pluginMetaData?.pluginMeta.registeredRemoteView],
    );

    const Element = useMemo(() => {
      if (!viewData?.tag) {
        return <Text>No renderer for {pluginInfo.plugin}</Text>;
      }

      if (!yjsPluginSceneData || !yjsPluginRendererData) {
        return <Text>Loading...</Text>;
      }

      return React.createElement(viewData.tag, {
        yjsPluginSceneData,
        yjsPluginRendererData,
        awarenessContext: {
          awarenessObj: provider!.awareness!,
          currentUserId: currentUserId!,
        } satisfies AwarenessContext,
        pluginContext: {
          pluginId,
          sceneId,
          organizationId: orgId,
        } as PluginContext,
        setRenderCurrentScene: () => {
          const renderer = getYJSPluginRenderer();
          if (renderer?.get("currentScene") !== sceneId) {
            renderer?.set("currentScene", sceneId);
          }
        },
        trpcClient,
      });
    }, [
      currentUserId,
      getYJSPluginRenderer,
      orgId,
      pluginId,
      pluginInfo.plugin,
      provider,
      sceneId,
      viewData?.tag,
      yjsPluginRendererData,
      yjsPluginSceneData,
    ]);

    if (match || viewData?.config?.alwaysRender) {
      return (
        <Box
          className={
            !match && viewData?.config?.alwaysRender ? "content-hidden" : ""
          }
        >
          {Element}
        </Box>
      );
    }

    return null;
  },
);

export default MainBody;
