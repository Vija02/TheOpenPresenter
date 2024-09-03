import { appData } from "@repo/lib";
import _ from "lodash";
import { useRef, useSyncExternalStore } from "react";
import { typeidUnboxed } from "typeid-js";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import { AbstractType, YEvent, Map as YMap } from "yjs";

import {
  AwarenessContext,
  ObjectToTypedMap,
  Plugin,
  PluginContext,
} from "../types";
import { createTraverser } from "../utils";
import { awarenessStore } from "./store";
import { getPathsFromSharedType, isYjsObj } from "./util";

const _watcher: Record<string, { id: string; callback: () => void }[]> = {};
// Only the paths that are below the paths that we are watching need to be refreshed
// Eg: If a__b__c is updated
// Then we refresh a__b__c AND a__b__c__d
const watcherCreateObserveHandler =
  (basePath: string[]) => (events: YEvent<any>[]) => {
    events.forEach((event) => {
      const eventPath = basePath
        .concat(event.path.map((x) => x.toString()))
        .join("__");

      const matchingWatchers = Object.entries(_watcher).filter(([key]) =>
        key.includes(eventPath),
      );
      console.log(matchingWatchers, _watcher, eventPath);
      matchingWatchers.forEach(([_key, val]) =>
        val.forEach((x) => x.callback()),
      );
    });
  };

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
  yjsPluginSceneData: ObjectToTypedMap<Plugin<PluginSceneDataType>>;
  yjsPluginRendererData: ObjectToTypedMap<PluginRendererDataType>;
  awarenessContext: AwarenessContext;
  pluginContext: PluginContext;
  setRenderCurrentScene: () => void;
}) {
  // TODO: Should only be called once

  const sceneBasePath = getPathsFromSharedType(yjsPluginSceneData);
  const sceneObserveHandler = watcherCreateObserveHandler(sceneBasePath);
  yjsPluginSceneData.observeDeep(sceneObserveHandler);

  const rendererBasePath = getPathsFromSharedType(yjsPluginRendererData);
  const rendererObserveHandler = watcherCreateObserveHandler(rendererBasePath);
  yjsPluginRendererData.observeDeep(rendererObserveHandler);

  const sceneTraverser = createTraverser<Plugin<PluginSceneDataType>>(
    yjsPluginSceneData!,
  );
  const rendererTraverser = createTraverser<PluginRendererDataType>(
    yjsPluginRendererData!,
  );

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
      useData<Y = any>(fn?: (x: Plugin<PluginSceneDataType>) => Y): Y {
        return useData<Y>(sceneTraverser, fn);
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
        return useData<Y>(rendererTraverser, fn);
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

      yjsPluginSceneData.unobserveDeep(sceneObserveHandler);
      yjsPluginRendererData.unobserveDeep(rendererObserveHandler);

      awarenessContext.awarenessObj.off("update", onAwarenessUpdate);
    },
  };
}

function useData<Y>(
  traverser: (
    traverseFunction?: any | undefined,
    returnClosestYjsObj?: boolean,
  ) => ObjectToTypedMap<ReturnType<any>>,
  fn?: (x: any) => Y,
) {
  const initialYjsObj = traverser(fn, true);
  if (!isYjsObj(initialYjsObj)) {
    return initialYjsObj;
  }

  const path = getPathsFromSharedType(
    initialYjsObj as unknown as YMap<any>,
  ).join("__");

  // We need this so that we can remove the watcher when unmounted
  const calledId = Math.random().toString();

  const prevDataRef = useRef<any | null>(null);

  return useSyncExternalStore(
    (callback) => {
      if (!_watcher[path]) _watcher[path] = [];
      _watcher[path]!.push({ id: calledId, callback });

      return () => {
        const index = _watcher[path]?.findIndex((x) => x.id === calledId);
        if (index) _watcher[path]?.splice(index, 1);
      };
    },
    () => {
      const data = traverser(fn);

      if (isYjsObj(data)) {
        const jsonData = (data as unknown as AbstractType<any>).toJSON();
        if (_.isEqual(prevDataRef.current, jsonData)) {
          return prevDataRef.current;
        } else {
          prevDataRef.current = jsonData;
          return prevDataRef.current;
        }
      } else {
        // If it's a primitive, we just return the data directly
        return data as Y;
      }
    },
    () => {
      const data = traverser(fn);

      if (isYjsObj(data)) {
        return data.toJson();
      }
      return data;
    },
  );
}
