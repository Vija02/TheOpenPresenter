import {
  AwarenessContext,
  AwarenessStateData,
  CurrentSceneInfo,
  Derivation,
  MAIN_LOOK_KEY,
  OverlayInfo,
  PluginContext,
  Scene,
  State,
  WebComponentProps,
  YjsWatcher,
} from "@repo/base-plugin";
import {
  PluginAPIContext,
  initStandalonePluginApi,
} from "@repo/base-plugin/client";
import {
  HostElement,
  LayoutDoc,
  LayoutFeed,
  activeFeeds,
  bindLookTarget,
  resolvePluginLook,
  simpleOutputInfo,
} from "@repo/layout";
import {
  HostRendererProvider,
  LayoutRenderer,
  resolveFeedSources,
  useFeedData,
  useReadOutputs,
} from "@repo/layout/react";
import { findClientPluginView, preloader } from "@repo/lib";
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
import React, {
  ReactNode,
  createContext,
  lazy,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useAnimatePresence } from "react-animate-presence";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "react-toastify";
import { useDisposable } from "use-disposable";
import * as Y from "yjs";

import { outputVolume } from "./outputVolume";
import { trpcClient } from "./trpc";

const useRendererId = () => {
  const { rendererId } = usePluginData();
  return rendererId;
};

const Landing = lazy(() => import("./Landing"));

/**
 * Whether the program's Black/Clear applies here. Null outside any box, so the
 * outermost box draws the black and the boxes inside a look inherit
 */
const FollowOverlayContext = createContext<boolean | null>(null);

/** Set for a simple output, whose one box keeps every scene ready to fade in */
const PreloadScenesContext = createContext(false);

/** Draws one output, named by the URL's `renderer` */
export const Body = ({
  hostElementId = null,
  hostSpec = null,
}: {
  /** Draw only this host element of the output, filling the frame. */
  hostElementId?: string | null;
  /** JSON `{ source, derivation, look, followOverlay }`, drawn the same way */
  hostSpec?: string | null;
}) => {
  const data = useData();
  const outputId = useRendererId();

  const outputs = useReadOutputs({
    renderer: data.renderer,
    outputs: data.outputs,
  });
  const output = outputs[outputId];
  const simple = useMemo(
    () => (output ? simpleOutputInfo(output.layout) : null),
    [output],
  );

  if (hostSpec) {
    const element = parseHostSpec(hostSpec);
    if (!element) return null;

    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <HostBox element={element} />
      </div>
    );
  }

  // One element on its own, for the layout editor's live preview
  if (hostElementId) {
    const element = output?.layout.elements.find(
      (candidate) => candidate.id === hostElementId,
    );

    if (!element || element.type !== "host") return null;

    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <HostBox element={element} />
      </div>
    );
  }

  if (!output) {
    return <Landing />;
  }

  if (
    simple?.look === MAIN_LOOK_KEY &&
    !data.renderer[simple.programId]?.currentScene
  ) {
    return <Landing />;
  }

  return (
    <PreloadScenesContext.Provider value={!!simple}>
      <LayoutOutputPluginApi>
        <LayoutWithFeeds doc={output.layout} />
      </LayoutOutputPluginApi>
    </PreloadScenesContext.Provider>
  );
};

const LayoutWithFeeds = ({
  doc,
  background = "#000",
}: {
  doc: LayoutDoc;
  background?: string;
}) => {
  const data = useData();
  const feeds = useMemo(() => activeFeeds(doc), [doc]);

  const resolveSources = useCallback(
    (feed: LayoutFeed) => resolveFeedSources(data, feed),
    [data],
  );

  const feedData = useFeedData(feeds, resolveSources);

  return (
    <HostRendererProvider render={renderHostElement}>
      <LayoutRenderer doc={doc} data={feedData} background={background} />
    </HostRendererProvider>
  );
};

/**
 * A layout draws the same elements a plugin does, but owns no plugin, so it
 * builds a standalone API from this screen's own host services.
 */
const LayoutOutputPluginApi = ({ children }: { children: ReactNode }) => {
  const { canPlayAudio } = useAudioCheck();
  const { addError, removeError } = useError();
  const { orgSlug, projectSlug } = usePluginMetaData();

  const pluginAPI = useMemo(
    () =>
      initStandalonePluginApi({
        pluginContext: {
          pluginId: "",
          sceneId: "",
          organizationId: orgSlug,
          projectId: projectSlug,
        },
        misc: {
          canPlayAudio,
          outputVolume,
          errorHandler: { addError, removeError },
          surface: "renderer",
        },
      }),
    [canPlayAudio, addError, removeError, orgSlug, projectSlug],
  );

  return (
    <PluginAPIContext.Provider value={{ pluginAPI }}>
      {children}
    </PluginAPIContext.Provider>
  );
};

const parseHostSpec = (spec: string): HostElement | null => {
  try {
    const { source, derivation, look, followOverlay } = JSON.parse(spec);
    if (!source?.kind) return null;
    return {
      source,
      derivation: derivation ?? null,
      look: look ?? null,
      followOverlay: followOverlay ?? true,
    } as HostElement;
  } catch {
    return null;
  }
};

/** Fills a layout's host elements with live application content */
const renderHostElement = ({ element }: { element: HostElement }) => (
  <HostBox element={element} />
);

const HostBox = ({ element }: { element: HostElement }) => {
  const { source, derivation } = element;
  const parentFollows = useContext(FollowOverlayContext);
  const preloadScenes = useContext(PreloadScenesContext);

  const follows = (parentFollows ?? true) && element.followOverlay !== false;
  const programId = source.kind === "self" ? null : source.rendererId;
  const lookKey = element.look ?? MAIN_LOOK_KEY;

  const content = (() => {
    switch (source.kind) {
      case "screen":
        return (
          <ProgramRenderer
            programId={source.rendererId}
            lookKey={lookKey}
            derivation={derivation}
            // Only the output's own box: a box inside a look shows one scene
            allScenes={preloadScenes && parentFollows === null}
          />
        );
      case "plugin":
        return (
          <ErrorBoundary FallbackComponent={ErrorAlert}>
            <PluginRenderer
              pluginId={source.pluginId}
              sceneId={source.sceneId}
              sourceRendererId={source.rendererId}
              inLayout
              derivation={derivation}
            />
          </ErrorBoundary>
        );
      case "scene":
        return (
          <SceneRenderer
            sceneId={source.sceneId}
            sourceRendererId={source.rendererId}
            inLayout
            derivation={derivation}
            lookKey={lookKey}
          />
        );
      // Only inside a look, which binds it before drawing
      case "self":
        return null;
    }
  })();

  return (
    <FollowOverlayContext.Provider value={follows}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        {content}
        {/* Boxes inside this one are covered by this black already */}
        {follows && parentFollows === null && programId && (
          <BlackOverlay programId={programId} />
        )}
      </div>
    </FollowOverlayContext.Provider>
  );
};

const BlackOverlay = ({ programId }: { programId: string }) => {
  const data = useData();

  const { ref, animationClassName, isRendered } = useAnimatePresence({
    visible: data.renderer[programId]?.overlay?.type === "black",
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

/**
 * A program's live scene in a look. The output's own box keeps every scene
 * mounted and fades between them, as a screen always has; a box inside a
 * layout shows the live one alone
 */
const ProgramRenderer = React.memo(
  ({
    programId,
    lookKey,
    derivation,
    allScenes,
  }: {
    programId: string;
    lookKey: string;
    derivation?: Derivation | null;
    allScenes: boolean;
  }) => {
    const data = useData();
    const program = data.renderer[programId];
    const currentSceneId = program?.currentScene ?? null;

    const sceneIds = useMemo(
      () =>
        allScenes
          ? Object.keys(program?.children ?? {})
          : currentSceneId
            ? [currentSceneId]
            : [],
      [allScenes, program?.children, currentSceneId],
    );

    return (
      <>
        {sceneIds.map((sceneId) => (
          <SceneRenderer
            key={sceneId}
            sceneId={sceneId}
            sourceRendererId={programId}
            inLayout
            transitions={allScenes}
            derivation={derivation}
            lookKey={lookKey}
          />
        ))}
      </>
    );
  },
);

const SceneRenderer = React.memo(
  ({
    sceneId,
    sourceRendererId,
    inLayout = false,
    transitions = false,
    derivation,
    lookKey = MAIN_LOOK_KEY,
  }: {
    sceneId: string;
    sourceRendererId?: string;
    inLayout?: boolean;
    transitions?: boolean;
    derivation?: Derivation | null;
    lookKey?: string;
  }) => {
    const data = useData();
    const rendererId = useRendererId();

    const effectiveRendererId = sourceRendererId || rendererId;

    const sourceRenderer = useMemo(
      () => data.renderer[effectiveRendererId],
      [data.renderer, effectiveRendererId],
    );
    const currentScene = useMemo(
      () => sourceRenderer?.currentScene,
      [sourceRenderer?.currentScene],
    );

    const pluginIds = useMemo(
      () => Object.keys(sourceRenderer?.children[sceneId] ?? {}),
      [sourceRenderer?.children, sceneId],
    );

    const isCurrentScene = currentScene === sceneId;

    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          zIndex: transitions && isCurrentScene ? 1 : 0,
        }}
        {...(isCurrentScene
          ? {
              "data-testid": "current-scene",
            }
          : {})}
      >
        <div
          className={cx(
            transitions &&
              (isCurrentScene
                ? "transition-fade-in"
                : "transition-fade-out delay-[400ms]"),
            "w-full h-full",
          )}
        >
          {pluginIds.map((pluginId) => (
            <ErrorBoundary key={pluginId} FallbackComponent={ErrorAlert}>
              <PluginLookRenderer
                pluginId={pluginId}
                sceneId={sceneId}
                sourceRendererId={effectiveRendererId}
                inLayout={inLayout}
                derivation={derivation}
                lookKey={lookKey}
              />
            </ErrorBoundary>
          ))}
        </div>
      </div>
    );
  },
);

/**
 * A plugin in a look. Its own version of the look is a layout around it,
 * drawn here; without one, it shows as it always does
 */
const PluginLookRenderer = React.memo(
  ({
    lookKey,
    ...props
  }: {
    pluginId: string;
    sceneId: string;
    sourceRendererId: string;
    inLayout: boolean;
    derivation?: Derivation | null;
    lookKey: string;
  }) => {
    const { pluginId, sceneId, sourceRendererId, inLayout } = props;
    const { pluginMeta } = usePluginMetaData();
    const data = useData();
    const pluginName = (data.data[sceneId] as Scene | undefined)?.children[
      pluginId
    ]?.plugin;
    const projectLooks = data.looks;

    const lookDoc = useMemo(() => {
      if (lookKey === MAIN_LOOK_KEY || !pluginName) return null;
      const registered =
        pluginMeta && "registeredLooks" in pluginMeta
          ? pluginMeta.registeredLooks
          : [];
      return resolvePluginLook(registered, projectLooks, pluginName, lookKey);
    }, [lookKey, pluginName, pluginMeta, projectLooks]);

    const doc = useMemo(
      () =>
        lookDoc
          ? bindLookTarget(lookDoc, {
              rendererId: sourceRendererId,
              sceneId,
              pluginId,
            })
          : null,
      [lookDoc, sourceRendererId, sceneId, pluginId],
    );

    if (!doc) return <PluginRenderer {...props} />;

    return (
      <div
        style={{
          position: "relative",
          width: inLayout ? "100%" : "100vw",
          height: inLayout ? "100%" : "100dvh",
        }}
      >
        <LayoutOutputPluginApi>
          <LayoutWithFeeds doc={doc} background="transparent" />
        </LayoutOutputPluginApi>
      </div>
    );
  },
);

const PluginRenderer = React.memo(
  ({
    pluginId,
    sceneId,
    sourceRendererId,
    inLayout = false,
    derivation,
  }: {
    pluginId: string;
    sceneId: string;
    sourceRendererId?: string;
    inLayout?: boolean;
    derivation?: Derivation | null;
  }) => {
    const [pluginDiv, setPluginDiv] = useState<HTMLDivElement | null>(null);
    const {
      pluginMeta,
      orgId,
      projectId,
      isPublicAccess,
      organizationType,
      experimentalFeaturesEnabled,
    } = usePluginMetaData();
    const {
      getYJSPluginRenderer,
      getYJSPluginSceneData,
      provider,
      mainYMap,
      currentUserId,
      rendererId,
    } = usePluginData();

    // The program this plugin plays in. The screen's own id names an output
    const effectiveRendererId = sourceRendererId || rendererId;
    const followsOverlay = useContext(FollowOverlayContext) ?? true;

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
    const view = useMemo(() => {
      if (pluginMeta && "registeredRendererView" in pluginMeta) {
        const native = pluginMeta.registeredRendererView.find(
          (x) => x.pluginName === pluginInfo?.plugin,
        );
        if (native?.tag) {
          return { tag: native.tag, pluginName: native.pluginName };
        }
      }
      // Handle client plugins
      if (pluginMeta && "clientPluginViews" in pluginMeta) {
        const client = findClientPluginView(
          pluginMeta.clientPluginViews as any[],
          pluginInfo?.plugin,
        );
        if (client) {
          return { tag: client.rendererTag, pluginName: client.pluginName };
        }
      }
      return undefined;
    }, [pluginInfo?.plugin, pluginMeta]);

    const tag = view?.tag;
    const resolvedPluginName = view?.pluginName ?? pluginInfo?.plugin;

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
      queryKey: ["preloader", resolvedPluginName],
      queryFn: () => {
        const data = preloader.getPluginPromise(resolvedPluginName!);
        return data;
      },
    });

    const overlay = useMemo<OverlayInfo>(
      () => ({
        getType: () => {
          if (!followsOverlay) return null;
          const renderer = getYJSPluginRenderer(effectiveRendererId);
          return renderer?.get("overlay")?.get("type") ?? null;
        },
        subscribe: (callback: () => void) => {
          if (!followsOverlay) return () => {};
          yjsWatcher?.watchYjs(
            (x: State) => x.renderer[effectiveRendererId]?.overlay,
            callback,
          );
          return () => {};
        },
      }),
      [getYJSPluginRenderer, effectiveRendererId, followsOverlay, yjsWatcher],
    );

    const currentScene = useMemo<CurrentSceneInfo>(
      () => ({
        get: () => {
          const renderer = getYJSPluginRenderer(effectiveRendererId);
          return renderer?.get("currentScene") ?? null;
        },
        subscribe: (callback: () => void) => {
          yjsWatcher?.watchYjs(
            (x: State) => x.renderer[effectiveRendererId]?.currentScene,
            callback,
          );
          return () => {};
        },
      }),
      [getYJSPluginRenderer, effectiveRendererId, yjsWatcher],
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

      if (
        !yjsPluginSceneData ||
        !yjsPluginRendererData ||
        !isSuccess ||
        !pluginDiv
      ) {
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
          const renderer = getYJSPluginRenderer(effectiveRendererId);
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
          outputVolume,
          overlay,
          currentScene,
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
          parentContainer: pluginDiv,
          surface: "renderer",
          derivation: derivation ?? null,
          isPublicAccess,
          organizationType,
          experimentalFeaturesEnabled,
          triggerKeyPress: () => {},
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
      isPublicAccess,
      isSuccess,
      organizationType,
      experimentalFeaturesEnabled,
      overlay,
      currentScene,
      pluginContext,
      pluginDiv,
      pluginInfo?.plugin,
      provider,
      removeError,
      effectiveRendererId,
      sceneId,
      setAwarenessStateData,
      tag,
      yjsPluginRendererData,
      yjsPluginSceneData,
    ]);

    return (
      <div
        ref={setPluginDiv}
        id={`pl-${resolvedPluginName}`}
        key={pluginId}
        style={{
          width: inLayout ? "100%" : "100vw",
          height: inLayout ? "100%" : "100dvh",
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        {TagElement}
      </div>
    );
  },
);
