import { Box, Text } from "@chakra-ui/react";
import { AwarenessContext, Scene } from "@repo/base-plugin";
import { MotionBox } from "@repo/ui";
import { AnimatePresence, motion } from "framer-motion";
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
      <Overlay />
      {Object.keys(currentRenderer?.children ?? {}).map((sceneId) => (
        <SceneRenderer key={sceneId} sceneId={sceneId} />
      ))}
    </>
  );
};

const Overlay = () => {
  const data = useData();
  const currentRenderer = useMemo(() => data.renderer["1"], [data.renderer]);

  return (
    <AnimatePresence>
      {currentRenderer?.overlay?.type === "black" && (
        <MotionBox
          key="black"
          top={0}
          left={0}
          right={0}
          bottom={0}
          position="absolute"
          bg="black"
          zIndex={999}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}
    </AnimatePresence>
  );
};

// TEST: All scenes should be rendered but only the main one shown
const SceneRenderer = React.memo(({ sceneId }: { sceneId: string }) => {
  const data = useData();

  const currentRenderer = useMemo(() => data.renderer["1"], [data.renderer]);
  const currentScene = useMemo(
    () => currentRenderer?.currentScene,
    [currentRenderer?.currentScene],
  );

  return (
    <Box position="absolute" zIndex={currentScene === sceneId ? 1 : 0}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={currentScene === sceneId ? "show" : "hidden"}
        variants={{
          show: { opacity: 1 },
          // DEBT: Get transition delay dynamically instead of hardcoding a duration
          hidden: { opacity: 0, transition: { delay: 0.4, duration: 0 } },
        }}
      >
        {Object.keys(currentRenderer?.children[sceneId] ?? {}).map(
          (pluginId) => (
            <PluginRenderer
              key={pluginId}
              pluginId={pluginId}
              sceneId={sceneId}
            />
          ),
        )}
      </motion.div>
    </Box>
  );
});

const PluginRenderer = React.memo(
  ({ pluginId, sceneId }: { pluginId: string; sceneId: string }) => {
    const pluginMetaData = usePluginMetaData().pluginMetaData;
    const {
      getYJSPluginRenderer,
      getYJSPluginRendererData,
      getYJSPluginSceneData,
      provider,
      currentUserId,
    } = usePluginData();
    const mainState = usePluginData().mainState!;

    const pluginInfo = useMemo(
      () => (mainState.data[sceneId] as Scene).children[pluginId],
      [sceneId, mainState.data, pluginId],
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
            yjsPluginSceneData: getYJSPluginSceneData(sceneId, pluginId),
            yjsPluginRendererData: getYJSPluginRendererData(sceneId, pluginId),
            awarenessContext: {
              awarenessObj: provider?.awareness,
              currentUserId,
            } as AwarenessContext,
            pluginContext: { pluginId, sceneId },
            setRenderCurrentScene: () => {
              getYJSPluginRenderer()?.set("currentScene", sceneId);
            },
            trpcClient,
          })
        ) : (
          <Text>No renderer for {pluginInfo?.plugin}</Text>
        ),
      [
        currentUserId,
        getYJSPluginRenderer,
        getYJSPluginRendererData,
        getYJSPluginSceneData,
        pluginId,
        pluginInfo?.plugin,
        provider?.awareness,
        sceneId,
        tag,
      ],
    );

    return <Box key={pluginId}>{TagElement}</Box>;
  },
);
