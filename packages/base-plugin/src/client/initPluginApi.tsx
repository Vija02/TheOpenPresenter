import { YjsWatcher, appData } from "@repo/lib";
import isEqual from "fast-deep-equal";
import { useSyncExternalStore } from "react";
import { useLocation } from "react-use";
import { typeidUnboxed } from "typeid-js";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import { Map as YMap } from "yjs";

import {
  AwarenessContext,
  MiscProps,
  ObjectToTypedMap,
  Plugin,
  PluginContext,
} from "../types";
import { OPFSStorageManager } from "./OPFSStorageManager";
import { awarenessStore } from "./store";

export function initPluginApi<
  PluginSceneDataType extends object = any,
  PluginRendererDataType extends object = any,
>({
  yjsPluginSceneData,
  yjsPluginRendererData,
  awarenessContext,
  pluginContext,
  setRenderCurrentScene,
  misc,
}: {
  yjsPluginSceneData: ObjectToTypedMap<Plugin<PluginSceneDataType>>;
  yjsPluginRendererData: ObjectToTypedMap<PluginRendererDataType>;
  awarenessContext: AwarenessContext;
  pluginContext: PluginContext;
  setRenderCurrentScene: () => void;
  misc: MiscProps;
}) {
  // TODO: Should only be called once
  const sceneWatcher = new YjsWatcher(yjsPluginSceneData as any);
  const rendererWatcher = new YjsWatcher(yjsPluginRendererData as any);

  // Valtio
  const sceneValtio = proxy({} as Plugin<PluginSceneDataType>);
  const unbindScene = bind(sceneValtio, yjsPluginSceneData as YMap<any>);

  const rendererValtio = proxy({} as PluginRendererDataType);
  const unbindRenderer = bind(rendererValtio, yjsPluginRendererData);

  // Awareness
  const getAwarenessState = (awareness: AwarenessContext["awarenessObj"]) => {
    return Array.from(awareness.getStates().values()) as any[];
  };

  const onAwarenessUpdate = () => {
    const newState = getAwarenessState(awarenessContext.awarenessObj);

    if (!isEqual(awarenessStore.getState().awarenessData, newState)) {
      awarenessStore.setState({
        awarenessData: newState,
      });
    }
  };
  // Set the initial value
  onAwarenessUpdate();
  // Then on all updates
  awarenessContext.awarenessObj.on("update", onAwarenessUpdate);

  const storageManager = new OPFSStorageManager(pluginContext.pluginId);

  return {
    env: appData,
    pluginContext,
    awareness: {
      awarenessObj: awarenessContext.awarenessObj,
      currentUserId: awarenessContext.currentUserId,
      useAwarenessData: () => awarenessStore((x) => x.awarenessData),
      setAwarenessStateData: misc.setAwarenessStateData,
    },
    media: {
      generateId: () => typeidUnboxed("media"),
      getUrl: (fileName: string) =>
        window.location.origin + "/media/data/" + fileName,
      tusUploadUrl: window.location.origin + "/media/upload/tus",
      formDataUploadUrl: window.location.origin + "/media/upload/form-data",
      pluginClientStorage: storageManager, // Scoped to plugin
      deleteMedia: misc.media.deleteMedia,
      completeMedia: misc.media.completeMedia,
    },
    scene: {
      // Use this for read
      useData<Y = any>(fn?: (x: Plugin<PluginSceneDataType>) => Y): Y {
        return sceneWatcher.useYjsData<Y>(fn);
      },
      // Use this for write
      useValtioData<O = undefined>() {
        return sceneValtio as Plugin<
          O extends undefined ? PluginSceneDataType : O
        >;
      },
    },
    renderer: {
      useData<Y = any>(fn?: (x: PluginRendererDataType) => Y): Y {
        return rendererWatcher.useYjsData<Y>(fn);
      },
      // Use this for write
      useValtioData<O = undefined>() {
        return rendererValtio as O extends undefined
          ? PluginRendererDataType
          : O;
      },
      setRenderCurrentScene,
    },
    remote: {
      usePluginInView: () => {
        const state = useLocation();

        const splittedPath = state.pathname?.split("/");
        if (!splittedPath) return false;

        const scene = splittedPath[splittedPath.length - 1];

        return pluginContext.sceneId === scene;
      },
      toast: misc.toast,
      zoomLevel: misc.zoomLevel,
    },
    audio: {
      useCanPlay: (options?: { skipCheck?: boolean }) => {
        return useSyncExternalStore(misc.canPlayAudio.subscribe, () =>
          options?.skipCheck
            ? misc.canPlayAudio._rawValue
            : misc.canPlayAudio.value,
        );
      },
    },
    log: misc.logger,
    error: {
      addError: misc.errorHandler.addError,
      removeError: misc.errorHandler.removeError,
    },
    dispose: () => {
      unbindScene();
      unbindRenderer();

      sceneWatcher.dispose();
      rendererWatcher.dispose();

      awarenessContext.awarenessObj.off("update", onAwarenessUpdate);
    },
  };
}
