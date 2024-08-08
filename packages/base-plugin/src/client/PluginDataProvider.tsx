import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useY } from "react-yjs";
import { proxy } from "valtio";
import { bind } from "valtio-yjs";
import type { Map } from "yjs";

import { Plugin, PluginContext } from "../types";

type PluginDataProviderType<PluginSceneDataType, PluginRendererDataType> = {
  setRenderCurrentScene: () => void;
  pluginContext: PluginContext;
  scene: {
    yjsData: Map<any> | null;
    valtio: Plugin | null;
    traverser:
      | ((
          traverseFunction?: TraverseFunction<Plugin<PluginSceneDataType>, any>,
        ) => Map<any>)
      | null;
  };
  renderer: {
    yjsData: Map<any> | null;
    valtio: Record<string, any> | null;
    traverser:
      | ((
          traverseFunction?: TraverseFunction<PluginRendererDataType, any>,
        ) => Map<any>)
      | null;
  };
};

const initialData: PluginDataProviderType<any, any> = {
  setRenderCurrentScene: () => {},
  pluginContext: { pluginId: "", sceneId: "" },
  scene: {
    yjsData: null,
    valtio: null,
    traverser: null,
  },
  renderer: {
    yjsData: null,
    valtio: null,
    traverser: null,
  },
};

export const PluginDataContext =
  createContext<PluginDataProviderType<any, any>>(initialData);

export function PluginDataProvider<
  PluginSceneDataType = any,
  PluginRendererDataType = any,
>({
  children,
  yjsPluginSceneData,
  yjsPluginRendererData,
  pluginContext,
  setRenderCurrentScene,
}: React.PropsWithChildren<{
  yjsPluginSceneData: Map<any>;
  yjsPluginRendererData: Map<any>;
  pluginContext: PluginContext;
  setRenderCurrentScene: () => void;
}>) {
  const [sceneValtio, setSceneValtio] = useState<Plugin | null>(null);
  const [rendererValtio, setRendererValtio] = useState<Record<
    string,
    any
  > | null>(null);

  useEffect(() => {
    const sceneV = proxy({} as Plugin);
    const unbind = bind(sceneV, yjsPluginSceneData);

    setSceneValtio(sceneV);

    return () => {
      unbind();
    };
  }, []);

  useEffect(() => {
    const rendererV = proxy({} as Plugin);
    const unbind = bind(rendererV, yjsPluginRendererData);

    setRendererValtio(rendererV);

    return () => {
      unbind();
    };
  }, []);

  const sceneTraverser = useCallback(
    createTraverser<Plugin<PluginSceneDataType>>(yjsPluginSceneData!),
    [],
  );
  const rendererTraverser = useCallback(
    createTraverser<Plugin<PluginRendererDataType>>(yjsPluginRendererData!),
    [],
  );

  return (
    <PluginDataContext.Provider
      value={{
        setRenderCurrentScene,
        pluginContext,
        scene: {
          yjsData: yjsPluginSceneData,
          valtio: sceneValtio,
          traverser: sceneTraverser,
        },
        renderer: {
          yjsData: yjsPluginRendererData,
          valtio: rendererValtio,
          traverser: rendererTraverser,
        },
      }}
    >
      {!!sceneValtio && !!rendererValtio && children}
    </PluginDataContext.Provider>
  );
}

export function getTypedProviderHelperFunctions<
  PluginSceneDataType = any,
  PluginRendererDataType = any,
>() {
  return {
    usePluginDataContext<
      O = undefined,
      X = undefined,
    >(): PluginDataProviderType<
      O extends undefined ? PluginSceneDataType : O,
      X extends undefined ? PluginRendererDataType : X
    > {
      return useContext(PluginDataContext);
    },
    useSetRenderCurrentScene: () => {
      const pluginDataContext = useContext(PluginDataContext);
      return () => {
        pluginDataContext.setRenderCurrentScene();
      };
    },
    scene: {
      // Use this for read
      useData<Y = any>(fn?: (x: Plugin<PluginSceneDataType>) => Y) {
        const pluginDataContext = useContext(PluginDataContext);
        const data = pluginDataContext.scene.traverser!(fn);

        if (typeof data === "object" && "doc" in data) {
          return useY(data) as Y;
        } else {
          // If it's a primitive, we just return the data directly
          return data;
        }
      },
      // Use this for write
      useValtioData<O = undefined>() {
        const pluginDataContext = useContext(PluginDataContext);
        return pluginDataContext.scene.valtio! as Plugin<
          O extends undefined ? PluginSceneDataType : O
        >;
      },
    },
    renderer: {
      // Use this for read
      useData<Y = any>(fn?: (x: PluginRendererDataType) => Y) {
        const pluginDataContext = useContext(PluginDataContext);
        const data = pluginDataContext.renderer.traverser!(fn);

        if (typeof data === "object" && "doc" in data) {
          return useY(data) as Y;
        } else {
          // If it's a primitive, we just return the data directly
          return data;
        }
      },
      // Use this for write
      useValtioData<O = undefined>() {
        const pluginDataContext = useContext(PluginDataContext);
        return pluginDataContext.renderer.valtio! as O extends undefined
          ? PluginRendererDataType
          : O;
      },
    },
  };
}

// TODO: Revisit the types for this function
type TraverseFunction<T, Y = any> = (x: T) => Y;
function createTraverser<T = any>(yData: Map<any>) {
  return (traverseFunction?: TraverseFunction<T>): Map<any> => {
    if (!traverseFunction) return yData;

    const originalValue = Symbol("originalValue");

    const handler = {
      get(target: any, key: any): any {
        if (key === originalValue) {
          return target;
        }

        const newTarget = target.get(key);
        // If not an yjs object, return it as it is
        if (typeof newTarget !== "object" || !("doc" in newTarget)) {
          return { [originalValue]: newTarget };
        }

        return new Proxy(newTarget, handler);
      },
    };

    const proxy = new Proxy(yData, handler);

    return traverseFunction(proxy)[originalValue];
  };
}
