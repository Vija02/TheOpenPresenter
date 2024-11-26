import { Box, Button, Flex, Stack, Text, chakra } from "@chakra-ui/react";
import {
  AwarenessContext,
  Plugin,
  PluginContext,
  Scene,
  State,
  YjsWatcher,
} from "@repo/base-plugin";
import { useKeyPressMutation } from "@repo/graphql";
import { ErrorAlert, OverlayToggle, PopConfirm } from "@repo/ui";
import React, { useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  VscSettingsGear as VscSettingsGearRaw,
  VscTrash as VscTrashRaw,
} from "react-icons/vsc";
import { useDisposable } from "use-disposable";
import { useLocation, useRoute } from "wouter";
import Y from "yjs";

import { useData, usePluginData } from "../contexts/PluginDataProvider";
import { usePluginMetaData } from "../contexts/PluginMetaDataProvider";
import { trpcClient } from "../trpc";
import { EmptyScene } from "./EmptyScene";
import SceneSettingsModal from "./SceneSettingsModal";

const VscSettingsGear = chakra(VscSettingsGearRaw);
const VscTrash = chakra(VscTrashRaw);

const MainBody = () => {
  const [location, navigate] = useLocation();

  const data = useData();
  const mainState = usePluginData().mainState!;
  const [keyPressMutate] = useKeyPressMutation();
  const projectId = usePluginMetaData().projectId;

  const selectedScene = useMemo(
    () => (data.data[location.slice(1)] ? location.slice(1) : null),
    [data.data, location],
  );

  const scenes = useMemo(
    () =>
      Object.entries(data.data).filter(([, value]) => value.type === "scene"),
    [data.data],
  );

  // On load, select the scene that is active if available
  useEffect(() => {
    const currentScene = mainState.renderer["1"]?.currentScene;
    if (!selectedScene) {
      if (currentScene) {
        navigate(`/${currentScene}`, { replace: true });
      } else if (scenes.length > 0) {
        navigate(`/${scenes[0]![0]}`, { replace: true });
      }
    }
  }, [mainState.renderer, navigate, scenes, selectedScene]);

  return (
    <Box
      display="flex"
      flexDir="column"
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
        flexShrink={0}
        boxShadow="md"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        p={2}
      >
        <Stack direction="row" px={2} alignItems="center">
          {selectedScene && (
            <>
              <Text fontWeight="bold">{data.data[selectedScene]?.name}</Text>
              <Stack direction="row" spacing={0}>
                <OverlayToggle
                  toggler={({ onToggle }) => (
                    <Button
                      size="sm"
                      variant="ghost"
                      justifyContent="center"
                      role="group"
                      onClick={onToggle}
                    >
                      <VscSettingsGear
                        color="gray.500"
                        fontSize="12px"
                        _groupHover={{ color: "gray.900" }}
                      />
                    </Button>
                  )}
                >
                  <SceneSettingsModal selectedScene={selectedScene} />
                </OverlayToggle>
                <PopConfirm
                  title={`Are you sure you want to remove this scene?`}
                  onConfirm={() => {
                    delete mainState.data[selectedScene];
                    if (
                      mainState.renderer["1"]?.currentScene === selectedScene
                    ) {
                      mainState.renderer["1"]!.currentScene = null;
                    }
                  }}
                  okText="Yes"
                  cancelText="No"
                  key="remove"
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    justifyContent="center"
                    role="group"
                  >
                    <VscTrash
                      color="gray.500"
                      _groupHover={{ color: "gray.900" }}
                    />
                  </Button>
                </PopConfirm>
              </Stack>
            </>
          )}
        </Stack>
        <Stack direction="row">
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
      <Box flex={1} overflow="auto">
        {scenes.map(([sceneId, value]) => (
          <SceneRenderer
            key={sceneId}
            sceneId={sceneId}
            value={value as Scene}
          />
        ))}
        {scenes.length === 0 && <EmptyScene />}
      </Box>
    </Box>
  );
};

const SceneRenderer = React.memo(
  ({ sceneId, value }: { sceneId: string; value: Scene }) => {
    return (
      <>
        {Object.entries(value.children).map(([pluginId, pluginInfo]) => (
          <ErrorBoundary key={pluginId} FallbackComponent={ErrorAlert}>
            <PluginRenderer
              sceneId={sceneId}
              pluginId={pluginId}
              pluginInfo={pluginInfo}
            />
          </ErrorBoundary>
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
      (x: State) => x.renderer?.["1"]?.children?.[sceneId]?.[pluginId],
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
          height="100%"
        >
          {Element}
        </Box>
      );
    }

    return null;
  },
);

export default MainBody;
