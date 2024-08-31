import { appData } from "@repo/lib";
import _ from "lodash";
import { useY } from "react-yjs";
import { typeidUnboxed } from "typeid-js";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import type { Map } from "yjs";

import { AwarenessContext, Plugin, PluginContext } from "../types";
import { createTraverser } from "../utils";
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
}: {
  yjsPluginSceneData: Map<any>;
  yjsPluginRendererData: Map<any>;
  awarenessContext: AwarenessContext;
  pluginContext: PluginContext;
  setRenderCurrentScene: () => void;
}) {
  // TODO: Should only be called once

  const sceneTraverser = createTraverser<Plugin<PluginSceneDataType>>(
    yjsPluginSceneData!,
  );
  const rendererTraverser = createTraverser<PluginRendererDataType>(
    yjsPluginRendererData!,
  );

  // Valtio
  const sceneValtio = proxy({} as Plugin<PluginSceneDataType>);
  const unbindScene = bind(sceneValtio, yjsPluginSceneData);

  const rendererValtio = proxy({} as PluginRendererDataType);
  const unbindRenderer = bind(rendererValtio, yjsPluginRendererData);

  // Awareness
  const getAwarenessState = (awareness: AwarenessContext["awarenessObj"]) => {
    return Array.from(awareness.getStates().values()) as any[];
  };

  const onAwarenessUpdate = () => {
    const newState = getAwarenessState(awarenessContext.awarenessObj);

    if (!_.isEqual(awarenessStore.getState().awarenessData, newState)) {
      awarenessStore.setState({
        awarenessData: newState,
      });
    }
  };
  // Set the initial value
  onAwarenessUpdate();
  // Then on all updates
  awarenessContext.awarenessObj.on("update", onAwarenessUpdate);

  return {
    env: appData,
    pluginContext,
    awareness: {
      awarenessObj: awarenessContext.awarenessObj,
      currentUserId: awarenessContext.currentUserId,
      useAwarenessData: () => awarenessStore((x) => x.awarenessData),
    },
    media: {
      generateId: () => typeidUnboxed("media"),
      getUrl: (fileName: string) =>
        appData.getRootURL() + "/media/data/" + fileName,
      tusUploadUrl: appData.getRootURL() + "/media/upload/tus",
      formDataUploadUrl: appData.getRootURL() + "/media/upload/form-data",
    },
    scene: {
      // Use this for read
      useData<Y = any>(fn?: (x: Plugin<PluginSceneDataType>) => Y) {
        const data = sceneTraverser(fn);

        if (!!data && typeof data === "object" && "doc" in data) {
          return useY(data as unknown as Map<any>) as Y;
        } else {
          // If it's a primitive, we just return the data directly
          return data as Y;
        }
      },
      // Use this for write
      useValtioData<O = undefined>() {
        return sceneValtio as Plugin<
          O extends undefined ? PluginSceneDataType : O
        >;
      },
    },
    renderer: {
      // Use this for read
      useData<Y = any>(fn?: (x: PluginRendererDataType) => Y) {
        const data = rendererTraverser(fn);

        if (!!data && typeof data === "object" && "doc" in data) {
          return useY(data as unknown as Map<any>) as Y;
        } else {
          // If it's a primitive, we just return the data directly
          return data as Y;
        }
      },
      // Use this for write
      useValtioData<O = undefined>() {
        return rendererValtio as O extends undefined
          ? PluginRendererDataType
          : O;
      },
      setRenderCurrentScene,
    },
    dispose: () => {
      unbindScene();
      unbindRenderer();

      awarenessContext.awarenessObj.off("update", onAwarenessUpdate);
    },
  };
}