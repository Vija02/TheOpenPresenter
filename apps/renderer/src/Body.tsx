import {
  AwarenessContext,
  AwarenessStateData,
  PluginContext,
  Scene,
  State,
  WebComponentProps,
  YjsWatcher,
} from "@repo/base-plugin";
import { RendererBasePluginQuery } from "@repo/graphql";
import { logger } from "@repo/observability";
import {
  useAudioCheck,
  useAwarenessState,
  useData,
  useError,
  usePluginData,
  usePluginMetaData,
} from "@repo/shared";
import { ErrorAlert, MotionBox } from "@repo/ui";
import { AnimatePresence, motion } from "framer-motion";
import React, { lazy, useCallback, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "react-toastify";
import { useDisposable } from "use-disposable";
import * as Y from "yjs";

import { trpcClient } from "./trpc";

const Landing = lazy(() => import("./Landing"));

export const Body = () => {
  const data = useData();

  const currentRenderer = useMemo(() => data.renderer["1"], [data.renderer]);
  const currentScene = useMemo(
    () => currentRenderer?.currentScene,
    [currentRenderer?.currentScene],
  );

  if (!currentScene) {
    return <Landing />;
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
    <div
      style={{ position: "absolute", zIndex: currentScene === sceneId ? 1 : 0 }}
      {...(currentScene === sceneId
        ? {
            "data-testid": "current-scene",
          }
        : {})}
    >
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
    </div>
  );
});

const PluginRenderer = React.memo(
  ({ pluginId, sceneId }: { pluginId: string; sceneId: string }) => {
    const pluginMetaData = usePluginMetaData()
      .pluginMetaData as RendererBasePluginQuery;
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
    const { addError, removeError } = useError();
    const setAwarenessState = useAwarenessState((x) => x.setAwarenessState);
    const setAwarenessStateData = useCallback(
      (data: AwarenessStateData) => {
        setAwarenessState(sceneId, pluginId, data);
      },
      [pluginId, sceneId, setAwarenessState],
    );

    const pluginContext: PluginContext = useMemo(
      () => ({
        pluginId,
        sceneId,
        organizationId: orgId,
      }),
      [orgId, pluginId, sceneId],
    );

    const childLogger = useMemo(
      () =>
        logger.child({
          context: pluginContext,
          plugin: pluginInfo?.plugin,
          pluginInfo: pluginInfo,
        }),
      [pluginContext, pluginInfo],
    );

    const TagElement = useMemo(() => {
      if (!tag) {
        return <p>No renderer for {pluginInfo?.plugin}</p>;
      }

      if (!yjsPluginSceneData || !yjsPluginRendererData) {
        return <p>Loading...</p>;
      }

      return React.createElement(tag, {
        yjsPluginSceneData,
        yjsPluginRendererData,
        awarenessContext: {
          awarenessObj: provider!.awareness!,
          currentUserId: currentUserId!,
        } satisfies AwarenessContext,
        pluginContext,
        setRenderCurrentScene: () => {
          const renderer = getYJSPluginRenderer();
          if (renderer?.get("currentScene") !== sceneId) {
            renderer?.set("currentScene", sceneId);
          }
        },
        trpcClient,
        misc: {
          setAwarenessStateData,
          zoomLevel: {} as any, // This should never be called
          errorHandler: { addError, removeError },
          canPlayAudio,
          toast,
          // These should probably never be called from the renderer
          media: {
            deleteMedia: () => {
              return Promise.reject();
            },
            completeMedia: () => {
              return Promise.reject();
            },
          },
          logger: childLogger,
        },
      } satisfies WebComponentProps<any>);
    }, [
      addError,
      canPlayAudio,
      childLogger,
      currentUserId,
      getYJSPluginRenderer,
      pluginContext,
      pluginInfo?.plugin,
      provider,
      removeError,
      sceneId,
      setAwarenessStateData,
      tag,
      yjsPluginRendererData,
      yjsPluginSceneData,
    ]);

    return (
      <div
        key={pluginId}
        style={{
          width: "100vw",
          height: "100vh",
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        {TagElement}
      </div>
    );
  },
);
