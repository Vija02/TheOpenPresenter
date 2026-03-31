import {
  AwarenessContext,
  AwarenessStateData,
  DerivationConfig,
  LayoutItem,
  OverlayInfo,
  PluginContext,
  RendererLayout,
  Scene,
  SceneLayoutPosition,
  State,
  WebComponentProps,
  YjsWatcher,
} from "@repo/base-plugin";
import { preloader } from "@repo/lib";
import { logger } from "@repo/observability";
import {
  useAudioCheck,
  useAwarenessState,
  useData,
  useError,
  usePluginData,
  usePluginMetaData,
} from "@repo/shared";
import { ErrorAlert, LoadingPart } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { cx } from "class-variance-authority";
import React, { lazy, useCallback, useMemo, useRef, useState } from "react";
import { useAnimatePresence } from "react-animate-presence";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "react-toastify";
import { useDisposable } from "use-disposable";
import * as Y from "yjs";

import { trpcClient } from "./trpc";

const useRendererId = () => {
  const { rendererId } = usePluginData();
  return rendererId;
};

const Landing = lazy(() => import("./Landing"));

export const Body = () => {
  const data = useData();
  const rendererId = useRendererId();

  const currentRenderer = useMemo(
    () => data.renderer[rendererId],
    [data.renderer, rendererId],
  );
  const currentScene = useMemo(
    () => currentRenderer?.currentScene,
    [currentRenderer?.currentScene],
  );
  const layout = useMemo(
    () => currentRenderer?.layout as RendererLayout | null | undefined,
    [currentRenderer?.layout],
  );

  if (layout?.enabled) {
    return (
      <>
        <Overlay />
        <LayoutContainer layout={layout}>
          {layout.items.map((item: LayoutItem) => {
            if (item.type === "screenItem") {
              return (
                <ScreenRenderer
                  key={item.id}
                  sourceRendererId={item.sourceRendererId}
                  layoutPosition={item.position}
                  derivation={item.derivation}
                  sceneOverrides={item.sceneOverrides}
                />
              );
            }

            return (
              <SceneRenderer
                key={item.id}
                sceneId={item.sceneId!}
                sourceRendererId={item.sourceRendererId}
                layoutPosition={item.position}
                derivation={item.derivation}
              />
            );
          })}
        </LayoutContainer>
      </>
    );
  }

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
  const rendererId = useRendererId();
  const currentRenderer = useMemo(
    () => data.renderer[rendererId],
    [data.renderer, rendererId],
  );

  const { ref, animationClassName, isRendered } = useAnimatePresence({
    visible: currentRenderer?.overlay?.type === "black",
    animation: {
      enter: "transition-fade-in",
      exit: "transition-fade-out",
    },
  });

  return (
    <>
      {isRendered && (
        <div
          key="black"
          ref={ref}
          className={cx(
            animationClassName,
            "top-0 left-0 right-0 bottom-0 absolute bg-black z-[999]",
          )}
        />
      )}
    </>
  );
};

// Enforces aspect ratio and centers content
const LayoutContainer = React.memo(
  ({
    layout,
    children,
  }: {
    layout: RendererLayout;
    children: React.ReactNode;
  }) => {
    const aspectWidth = layout.aspectRatio?.width ?? 16;
    const aspectHeight = layout.aspectRatio?.height ?? 9;

    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            maxWidth: `calc(100vh * ${aspectWidth} / ${aspectHeight})`,
            maxHeight: `calc(100vw * ${aspectHeight} / ${aspectWidth})`,
            aspectRatio: `${aspectWidth} / ${aspectHeight}`,
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      </div>
    );
  },
);

// Mirror another renderer's current scene
const ScreenRenderer = React.memo(
  ({
    sourceRendererId,
    layoutPosition,
    derivation,
    sceneOverrides,
  }: {
    sourceRendererId: string;
    layoutPosition: SceneLayoutPosition;
    derivation?: DerivationConfig | null;
    sceneOverrides?: Record<string, DerivationConfig | null>;
  }) => {
    const data = useData();

    const sourceRenderer = useMemo(
      () => data.renderer[sourceRendererId],
      [data.renderer, sourceRendererId],
    );
    const currentSceneId = useMemo(
      () => sourceRenderer?.currentScene,
      [sourceRenderer?.currentScene],
    );

    if (!currentSceneId) {
      return null;
    }

    // Check for scene-specific derivation override
    const effectiveDerivation =
      sceneOverrides?.[currentSceneId] !== undefined
        ? sceneOverrides[currentSceneId]
        : derivation;

    return (
      <SceneRenderer
        sceneId={currentSceneId}
        sourceRendererId={sourceRendererId}
        layoutPosition={layoutPosition}
        derivation={effectiveDerivation}
      />
    );
  },
);

// Renders a scene, optionally at a specific layout position & renderer
const SceneRenderer = React.memo(
  ({
    sceneId,
    sourceRendererId,
    layoutPosition,
    derivation,
  }: {
    sceneId: string;
    sourceRendererId?: string;
    layoutPosition?: SceneLayoutPosition;
    derivation?: DerivationConfig | null;
  }) => {
    const data = useData();
    const rendererId = useRendererId();

    // Use source renderer if specified, otherwise use current renderer
    const effectiveRendererId = sourceRendererId || rendererId;

    const currentRenderer = useMemo(
      () => data.renderer[rendererId],
      [data.renderer, rendererId],
    );
    const sourceRenderer = useMemo(
      () => data.renderer[effectiveRendererId],
      [data.renderer, effectiveRendererId],
    );
    const currentScene = useMemo(
      () => currentRenderer?.currentScene,
      [currentRenderer?.currentScene],
    );

    const pluginIds = useMemo(
      () => Object.keys(sourceRenderer?.children[sceneId] ?? {}),
      [sourceRenderer?.children, sceneId],
    );

    const isCurrentScene = currentScene === sceneId;
    const isLayoutMode = !!layoutPosition;

    const containerStyle: React.CSSProperties = isLayoutMode
      ? {
          // Layout mode
          position: "absolute",
          left: `${layoutPosition.x}%`,
          top: `${layoutPosition.y}%`,
          width: `${layoutPosition.width}%`,
          height: `${layoutPosition.height}%`,
          overflow: "hidden",
        }
      : {
          // Normal mode
          position: "absolute",
          zIndex: isCurrentScene ? 1 : 0,
        };

    return (
      <div
        style={containerStyle}
        {...(isCurrentScene
          ? {
              "data-testid": "current-scene",
            }
          : {})}
      >
        <div
          className={cx(
            // Only apply fade transitions in normal mode
            !isLayoutMode &&
              (isCurrentScene
                ? "transition-fade-in"
                : "transition-fade-out delay-[400ms]"),
            "w-full h-full",
          )}
        >
          {pluginIds.map((pluginId) => (
            <ErrorBoundary key={pluginId} FallbackComponent={ErrorAlert}>
              <PluginRenderer
                pluginId={pluginId}
                sceneId={sceneId}
                sourceRendererId={effectiveRendererId}
                layoutPosition={layoutPosition}
                derivation={derivation}
              />
            </ErrorBoundary>
          ))}
        </div>
      </div>
    );
  },
);

const PluginRenderer = React.memo(
  ({
    pluginId,
    sceneId,
    sourceRendererId,
    layoutPosition,
    derivation,
  }: {
    pluginId: string;
    sceneId: string;
    sourceRendererId?: string;
    layoutPosition?: SceneLayoutPosition;
    derivation?: DerivationConfig | null;
  }) => {
    const pluginDivRef = useRef<HTMLDivElement>(null);
    const { pluginMeta, orgId, projectId } = usePluginMetaData();
    const {
      getYJSPluginRenderer,
      getYJSPluginSceneData,
      provider,
      mainYMap,
      currentUserId,
      rendererId,
    } = usePluginData();

    const effectiveRendererId = sourceRendererId || rendererId;

    // Include rendererId in deps to recreate watcher when renderer changes
    const yjsWatcher = useDisposable(() => {
      const watcher = new YjsWatcher(mainYMap! as Y.Map<any>);
      return [watcher, () => watcher.dispose()];
    }, [mainYMap, effectiveRendererId]);

    const [yjsPluginSceneData] = useState(
      getYJSPluginSceneData(sceneId, pluginId),
    );

    // Renderer is added through the server and requires an extra update. So we use a watcher here
    const yjsPluginRendererData = yjsWatcher?.useYjs<any>(
      (x: State) =>
        x.renderer?.[effectiveRendererId]?.children?.[sceneId]?.[pluginId],
    );

    const mainState = usePluginData().mainState!;

    const pluginInfo = useMemo(
      () => (mainState.data[sceneId] as Scene).children[pluginId],
      [sceneId, mainState.data, pluginId],
    );
    const tag = useMemo(() => {
      if (pluginMeta && "registeredRendererView" in pluginMeta) {
        return pluginMeta.registeredRendererView.find(
          (x) => x.pluginName === pluginInfo?.plugin,
        )?.tag;
      }
      return undefined;
    }, [pluginInfo?.plugin, pluginMeta]);

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
        projectId,
      }),
      [orgId, pluginId, projectId, sceneId],
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

    const { isSuccess, error } = useQuery({
      queryKey: ["preloader", pluginInfo?.plugin],
      queryFn: () => {
        const data = preloader.getPluginPromise(pluginInfo!.plugin);
        return data;
      },
    });

    const overlay = useMemo<OverlayInfo>(
      () => ({
        getType: () => {
          const renderer = getYJSPluginRenderer(rendererId);
          return renderer?.get("overlay")?.get("type") ?? null;
        },
        subscribe: (callback: () => void) => {
          yjsWatcher?.watchYjs(
            (x: State) => x.renderer[rendererId]?.overlay,
            callback,
          );
          return () => {};
        },
      }),
      [getYJSPluginRenderer, rendererId, yjsWatcher],
    );

    const TagElement = useMemo(() => {
      if (!tag) {
        return (
          <ErrorAlert
            error={new Error(`No renderer for ${pluginInfo?.plugin}`)}
          />
        );
      }
      if (error) {
        return <ErrorAlert error={error} />;
      }

      if (!yjsPluginSceneData || !yjsPluginRendererData || !isSuccess) {
        return <LoadingPart />;
      }

      // We don't want to render this until the web component is hooked because
      // the objects that are passed are not picked up correctly which leads to various errors.
      return React.createElement(tag, {
        yjsPluginSceneData,
        yjsPluginRendererData,
        awarenessContext: {
          awarenessObj: provider!.awareness!,
          currentUserId: currentUserId!,
        } satisfies AwarenessContext,
        pluginContext,
        setRenderCurrentScene: () => {
          const renderer = getYJSPluginRenderer(rendererId);
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
          overlay,
          toast,
          // These should probably never be called from the renderer
          media: {
            permanentlyDeleteMedia: () => {
              return Promise.reject();
            },
            completeMedia: () => {
              return Promise.reject();
            },
            unlinkMediaFromPlugin: () => {
              return Promise.reject();
            },
          },
          mediaPicker: {
            show: () => {
              return Promise.reject(
                new Error("Media picker not available in renderer"),
              );
            },
          },
          logger: childLogger,
          parentContainer: pluginDivRef.current,
          derivation: derivation ?? null,
        },
      } satisfies WebComponentProps<any>);
    }, [
      addError,
      canPlayAudio,
      childLogger,
      currentUserId,
      derivation,
      error,
      getYJSPluginRenderer,
      isSuccess,
      overlay,
      pluginContext,
      pluginInfo?.plugin,
      provider,
      removeError,
      rendererId,
      sceneId,
      setAwarenessStateData,
      tag,
      yjsPluginRendererData,
      yjsPluginSceneData,
    ]);

    return (
      <div
        ref={pluginDivRef}
        id={`pl-${pluginInfo?.plugin}`}
        key={pluginId}
        style={{
          width: layoutPosition ? "100%" : "100vw",
          height: layoutPosition ? "100%" : "100dvh",
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        {TagElement}
      </div>
    );
  },
);
