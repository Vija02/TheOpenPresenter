import {
  AwarenessContext,
  AwarenessStateData,
  KeyPressType,
  OverlayInfo,
  Plugin,
  PluginContext,
  State,
  WebComponentProps,
  YjsWatcher,
} from "@repo/base-plugin";
import { useMediaPicker } from "@repo/base-plugin/client";
import {
  useCompleteMediaMutation,
  useDeleteMediaMutation,
  useKeyPressMutation,
  useUnlinkMediaFromPluginMutation,
} from "@repo/graphql";
import {
  preloader,
  uuidFromMediaIdOrUUIDOrMediaName,
  uuidFromPluginIdOrUUID,
} from "@repo/lib";
import { logger } from "@repo/observability";
import {
  useAudioCheck,
  useAwarenessState,
  useError,
  usePluginData,
  usePluginMetaData,
} from "@repo/shared";
import { ErrorAlert, LoadingPart } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { cx } from "class-variance-authority";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useDisposable } from "use-disposable";
import { useRoute } from "wouter";
import * as Y from "yjs";

import { useRendererSelection } from "../../contexts/rendererSelection";
import { zoomLevelStore } from "../../contexts/zoomLevel";
import { trpcClient } from "../../trpc";
import { getSceneOwnershipStatus } from "../../util/sceneOwnership";

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
    const pluginDivRef = useRef<HTMLDivElement>(null);
    const { pluginMeta, orgId, projectId, isPublicAccess, organizationType } =
      usePluginMetaData();
    const {
      getYJSPluginRenderer,
      getYJSPluginSceneData,
      provider,
      mainYMap,
      currentUserId,
    } = usePluginData();
    const { selectedRendererId } = useRendererSelection();

    // Include selectedRendererId in deps to recreate watcher when renderer changes
    const yjsWatcher = useDisposable(() => {
      const watcher = new YjsWatcher(mainYMap! as Y.Map<any>);
      return [watcher, () => watcher.dispose()];
    }, [mainYMap, selectedRendererId]);

    const [yjsPluginSceneData] = useState(
      getYJSPluginSceneData(sceneId, pluginId),
    );

    // Renderer is added through the server and requires an extra update. So we use a watcher here
    const yjsPluginRendererData = yjsWatcher?.useYjs<any>(
      (x: State) =>
        x.renderer?.[selectedRendererId]?.children?.[sceneId]?.[pluginId],
    );

    const [match] = useRoute(`/${sceneId}`);

    const viewData = useMemo(() => {
      if (pluginMeta && "registeredRemoteView" in pluginMeta) {
        return pluginMeta.registeredRemoteView.find(
          (x) => x.pluginName === pluginInfo.plugin,
        );
      }
      return undefined;
    }, [pluginInfo.plugin, pluginMeta]);

    const { canPlayAudio } = useAudioCheck();
    const { addError, removeError } = useError();
    const setAwarenessState = useAwarenessState((x) => x.setAwarenessState);
    const setAwarenessStateData = useCallback(
      (data: AwarenessStateData) => {
        setAwarenessState(sceneId, pluginId, data);
      },
      [pluginId, sceneId, setAwarenessState],
    );

    const mediaPicker = useMediaPicker();

    const [, deleteMedia] = useDeleteMediaMutation();
    const [, completeMedia] = useCompleteMediaMutation();
    const [, unlinkMediaFromPlugin] = useUnlinkMediaFromPluginMutation();
    const [, keyPressMutate] = useKeyPressMutation();

    const triggerKeyPress = useCallback(
      (keyType: KeyPressType, sceneId?: string) => {
        keyPressMutate({
          keyType,
          projectId,
          rendererId: selectedRendererId,
          sceneId,
        });
      },
      [keyPressMutate, projectId, selectedRendererId],
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
          plugin: pluginInfo.plugin,
          pluginInfo: pluginInfo,
        }),
      [pluginContext, pluginInfo],
    );

    const { isSuccess, error } = useQuery({
      queryKey: ["preloader", pluginInfo.plugin],
      queryFn: () => {
        const data = preloader.getPluginPromise(pluginInfo.plugin);
        return data;
      },
    });

    const overlay = useMemo<OverlayInfo>(
      () => ({
        getType: () => {
          const renderer = getYJSPluginRenderer(selectedRendererId);
          return renderer?.get("overlay")?.get("type") ?? null;
        },
        subscribe: (callback: () => void) => {
          yjsWatcher?.watchYjs(
            (x: State) => x.renderer[selectedRendererId]?.overlay,
            callback,
          );
          return () => {};
        },
      }),
      [getYJSPluginRenderer, selectedRendererId, yjsWatcher],
    );

    const Element = useMemo(() => {
      if (!viewData?.tag) {
        return (
          <ErrorAlert
            error={new Error(`No renderer for ${pluginInfo.plugin}`)}
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
      return React.createElement(viewData.tag, {
        yjsPluginSceneData,
        yjsPluginRendererData,
        awarenessContext: {
          awarenessObj: provider!.awareness!,
          currentUserId: currentUserId!,
        } satisfies AwarenessContext,
        pluginContext,
        setRenderCurrentScene: () => {
          const renderer = getYJSPluginRenderer(selectedRendererId);
          const ownedScenes = renderer?.get("ownedScenes");
          // Don't allow setting currentScene to a hidden scene
          if (!getSceneOwnershipStatus(ownedScenes, sceneId).visible) {
            return;
          }
          if (renderer?.get("currentScene") !== sceneId) {
            renderer?.set("currentScene", sceneId);
          }
        },
        trpcClient,
        misc: {
          setAwarenessStateData,
          triggerKeyPress,
          zoomLevel: zoomLevelStore,
          errorHandler: { addError, removeError },
          canPlayAudio,
          overlay,
          toast,
          media: {
            permanentlyDeleteMedia: (mediaKey: string) => {
              const uuid = uuidFromMediaIdOrUUIDOrMediaName(mediaKey);
              return deleteMedia({ id: uuid });
            },
            completeMedia: (mediaKey: string) => {
              const uuid = uuidFromMediaIdOrUUIDOrMediaName(mediaKey);
              return completeMedia({ id: uuid });
            },
            unlinkMediaFromPlugin: (mediaKey) => {
              const mediaUUID = mediaKey
                ? uuidFromMediaIdOrUUIDOrMediaName(mediaKey)
                : null;
              const pluginId = uuidFromPluginIdOrUUID(pluginContext.pluginId);
              return unlinkMediaFromPlugin({
                pluginId,
                mediaUUID,
                projectId: pluginContext.projectId,
              });
            },
          },
          mediaPicker,
          logger: childLogger,
          parentContainer: pluginDivRef.current,
          isPublicAccess,
          organizationType,
        },
      } satisfies WebComponentProps<any>);
    }, [
      addError,
      canPlayAudio,
      childLogger,
      completeMedia,
      currentUserId,
      deleteMedia,
      error,
      getYJSPluginRenderer,
      isPublicAccess,
      isSuccess,
      mediaPicker,
      organizationType,
      overlay,
      pluginContext,
      pluginInfo.plugin,
      provider,
      removeError,
      sceneId,
      selectedRendererId,
      setAwarenessStateData,
      triggerKeyPress,
      unlinkMediaFromPlugin,
      viewData?.tag,
      yjsPluginRendererData,
      yjsPluginSceneData,
    ]);

    return (
      <div
        ref={pluginDivRef}
        id={`pl-${pluginInfo.plugin}`}
        className={cx(
          !match && viewData?.config?.alwaysRender ? "content-hidden" : "",
          match && "h-full",
        )}
      >
        {match || viewData?.config?.alwaysRender ? Element : null}
      </div>
    );
  },
);

export default PluginRenderer;
