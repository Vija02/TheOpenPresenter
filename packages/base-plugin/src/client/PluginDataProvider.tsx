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
import { createTraverser } from "../utils";

type PluginDataProviderType<PluginSceneDataType, PluginRendererDataType> = {
  setRenderCurrentScene: () => void;
  pluginContext: PluginContext;
  scene: {
    yjsData: Map<any> | null;
    valtio: Plugin | null;
    traverser: ReturnType<
      typeof createTraverser<Plugin<PluginSceneDataType>>
    > | null;
  };
  renderer: {
    yjsData: Map<any> | null;
    valtio: Record<string, any> | null;
    traverser: ReturnType<
      typeof createTraverser<PluginRendererDataType>
    > | null;
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
    createTraverser<PluginRendererDataType>(yjsPluginRendererData!),
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

        if (!!data && typeof data === "object" && "doc" in data) {
          return useY(data as unknown as Map<any>) as Y;
        } else {
          // If it's a primitive, we just return the data directly
          return data as Y;
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

        if (!!data && typeof data === "object" && "doc" in data) {
          return useY(data as unknown as Map<any>) as Y;
        } else {
          // If it's a primitive, we just return the data directly
          return data as Y;
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
