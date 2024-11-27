import { Box, Text } from "@chakra-ui/react";
import { AwarenessContext, Scene, State, YjsWatcher } from "@repo/base-plugin";
import { ErrorAlert, MotionBox } from "@repo/ui";
import { AnimatePresence, motion } from "framer-motion";
import React, { useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useDisposable } from "use-disposable";
import Y from "yjs";

import { useAudioCheck } from "./contexts/AudioCheckProvider";
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
            <ErrorBoundary key={pluginId} FallbackComponent={ErrorAlert}>
              <PluginRenderer pluginId={pluginId} sceneId={sceneId} />
            </ErrorBoundary>
          ),
        )}
      </motion.div>
    </Box>
  );
});

const PluginRenderer = React.memo(
  ({ pluginId, sceneId }: { pluginId: string; sceneId: string }) => {
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

    const { canPlayAudio } = useAudioCheck();

    const TagElement = useMemo(() => {
      if (!tag) {
        return <Text>No renderer for {pluginInfo?.plugin}</Text>;
      }

      if (!yjsPluginSceneData || !yjsPluginRendererData) {
        return <Text>Loading...</Text>;
      }

      return React.createElement(tag, {
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
        },
        setRenderCurrentScene: () => {
          const renderer = getYJSPluginRenderer();
          if (renderer?.get("currentScene") !== sceneId) {
            renderer?.set("currentScene", sceneId);
          }
        },
        trpcClient,
        canPlayAudio,
      });
    }, [
      canPlayAudio,
      currentUserId,
      getYJSPluginRenderer,
      orgId,
      pluginId,
      pluginInfo?.plugin,
      provider,
      sceneId,
      tag,
      yjsPluginRendererData,
      yjsPluginSceneData,
    ]);

    return (
      <Box
        key={pluginId}
        width="100vw"
        height="100vh"
        userSelect="none"
        pointerEvents="none"
      >
        {TagElement}
      </Box>
    );
  },
);
