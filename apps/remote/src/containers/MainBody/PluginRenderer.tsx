import {
  AwarenessContext,
  AwarenessStateData,
  Plugin,
  PluginContext,
  State,
  WebComponentProps,
  YjsWatcher,
} from "@repo/base-plugin";
import {
  RemoteBasePluginQuery,
  useCompleteMediaMutation,
  useDeleteMediaMutation,
} from "@repo/graphql";
import { preloader } from "@repo/lib";
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
import { TypeId, toUUID } from "typeid-js";
import { useDisposable } from "use-disposable";
import { useRoute } from "wouter";
import * as Y from "yjs";

import { zoomLevelStore } from "../../contexts/zoomLevel";
import { trpcClient } from "../../trpc";

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

    const [, deleteMedia] = useDeleteMediaMutation();
    const [, completeMedia] = useCompleteMediaMutation();

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

    const { isSuccess, error } = useQuery({
      queryKey: ["preloader", pluginInfo.plugin],
      queryFn: () => {
        const data = preloader.getPluginPromise(pluginInfo.plugin);
        return data;
      },
    });

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

              return deleteMedia({ id: uuid });
            },
            completeMedia: (mediaName: string) => {
              const splittedKey = mediaName.split(".");
              const mediaId = splittedKey[0];
              const uuid = toUUID(mediaId as TypeId<string>);

              return completeMedia({ id: uuid });
            },
          },
          logger: childLogger,
          parentContainer: pluginDivRef.current,
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
      isSuccess,
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
