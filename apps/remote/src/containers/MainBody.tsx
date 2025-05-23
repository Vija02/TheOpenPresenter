import {
  AwarenessContext,
  AwarenessStateData,
  Plugin,
  PluginContext,
  Scene,
  State,
  WebComponentProps,
  YjsWatcher,
} from "@repo/base-plugin";
import {
  RemoteBasePluginQuery,
  useCompleteMediaMutation,
  useDeleteMediaMutation,
  useKeyPressMutation,
} from "@repo/graphql";
import { logger } from "@repo/observability";
import {
  useAudioCheck,
  useAwarenessState,
  useData,
  useError,
  usePluginData,
  usePluginMetaData,
} from "@repo/shared";
import {
  Button,
  ErrorAlert,
  LoadingPart,
  OverlayToggle,
  PopConfirm,
  Slider,
} from "@repo/ui";
import { cx } from "class-variance-authority";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { RxCross1 } from "react-icons/rx";
import { VscSettingsGear, VscTrash } from "react-icons/vsc";
import { toast } from "react-toastify";
import { TypeId, toUUID } from "typeid-js";
import { useDisposable } from "use-disposable";
import { useLocation, useRoute } from "wouter";
import * as Y from "yjs";
import { useStore } from "zustand";

import { zoomLevelStore } from "../contexts/zoomLevel";
import { trpcClient } from "../trpc";
import { EmptyScene } from "./EmptyScene";
import SceneSettingsModal from "./SceneSettingsModal";

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

  const { zoomLevel, setZoomLevel } = useStore(zoomLevelStore);

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
    <div
      className="flex flex-col w-full overflow-hidden"
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
      <div className="flex shrink-0 shadow items-center justify-between flex-wrap p-2">
        <div className="stack-row px-2">
          {selectedScene && (
            <>
              <p className="font-bold text-sm">
                {data.data[selectedScene]?.name}
              </p>
              <div className="stack-row gap-0">
                <OverlayToggle
                  toggler={({ onToggle }) => (
                    <Button
                      size="sm"
                      variant="ghost"
                      role="group"
                      onClick={onToggle}
                      className=" text-gray-500 hover:text-gray-900"
                    >
                      <VscSettingsGear className="size-3" />
                    </Button>
                  )}
                >
                  <SceneSettingsModal selectedScene={selectedScene} />
                </OverlayToggle>
                <PopConfirm
                  onConfirm={() => {
                    delete mainState.data[selectedScene];
                    if (
                      mainState.renderer["1"]?.currentScene === selectedScene
                    ) {
                      mainState.renderer["1"]!.currentScene = null;
                    }
                  }}
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    role="group"
                    className=" text-gray-500 hover:text-gray-900"
                  >
                    <VscTrash className="size-3.5" />
                  </Button>
                </PopConfirm>
              </div>
            </>
          )}
        </div>
        <div className="stack-row gap-0">
          <Button
            size="sm"
            className={cx(
              "rounded-none border-2 border-fill-default",
              data.renderer["1"]!.overlay &&
                data.renderer["1"]!.overlay.type === "black"
                ? "animate-border-blink bg-fill-default-selected"
                : "",
            )}
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
          {mainState.renderer["1"]!.overlay !== null && (
            <Button
              size="sm"
              className="rounded-none"
              onClick={() => {
                mainState.renderer["1"]!.overlay = null;
              }}
            >
              <RxCross1 className="size-3" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {scenes.map(([sceneId, value]) => (
          <SceneRenderer
            key={sceneId}
            sceneId={sceneId}
            value={value as Scene}
          />
        ))}
        {scenes.length === 0 && <EmptyScene />}
      </div>
      <div className="flex flex-row-reverse py-3 px-4 border-stroke border-t-1">
        <Slider
          min={0}
          max={1}
          value={[zoomLevel]}
          onValueChange={(val) => setZoomLevel(val[0]!)}
          step={0.0001}
          className="max-w-52"
        ></Slider>
      </div>
    </div>
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
    const pluginMetaData = usePluginMetaData()
      .pluginMetaData as RemoteBasePluginQuery;
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

    const { canPlayAudio } = useAudioCheck();
    const { addError, removeError } = useError();
    const setAwarenessState = useAwarenessState((x) => x.setAwarenessState);
    const setAwarenessStateData = useCallback(
      (data: AwarenessStateData) => {
        setAwarenessState(sceneId, pluginId, data);
      },
      [pluginId, sceneId, setAwarenessState],
    );

    const [deleteMedia] = useDeleteMediaMutation();
    const [completeMedia] = useCompleteMediaMutation();

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
          plugin: pluginInfo.plugin,
          pluginInfo: pluginInfo,
        }),
      [pluginContext, pluginInfo],
    );

    const Element = useMemo(() => {
      if (!viewData?.tag) {
        return <p>No renderer for {pluginInfo.plugin}</p>;
      }

      if (!yjsPluginSceneData || !yjsPluginRendererData) {
        return <LoadingPart />;
      }

      return React.createElement(viewData.tag, {
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
          zoomLevel: zoomLevelStore,
          errorHandler: { addError, removeError },
          canPlayAudio,
          toast,
          media: {
            deleteMedia: (mediaName: string) => {
              const splittedKey = mediaName.split(".");
              const mediaId = splittedKey[0];
              const uuid = toUUID(mediaId as TypeId<string>);

              return deleteMedia({ variables: { id: uuid } });
            },
            completeMedia: (mediaName: string) => {
              const splittedKey = mediaName.split(".");
              const mediaId = splittedKey[0];
              const uuid = toUUID(mediaId as TypeId<string>);

              return completeMedia({ variables: { id: uuid } });
            },
          },
          logger: childLogger,
        },
      } satisfies WebComponentProps<any>);
    }, [
      addError,
      canPlayAudio,
      childLogger,
      completeMedia,
      currentUserId,
      deleteMedia,
      getYJSPluginRenderer,
      pluginContext,
      pluginInfo.plugin,
      provider,
      removeError,
      sceneId,
      setAwarenessStateData,
      viewData?.tag,
      yjsPluginRendererData,
      yjsPluginSceneData,
    ]);

    if (match || viewData?.config?.alwaysRender) {
      return (
        <div
          className={cx(
            !match && viewData?.config?.alwaysRender ? "content-hidden" : "",
            "h-full",
          )}
        >
          {Element}
        </div>
      );
    }

    return null;
  },
);

export default MainBody;
