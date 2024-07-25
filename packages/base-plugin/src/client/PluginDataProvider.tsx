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

import { Plugin } from "../types";

type PluginDataProviderType<T> = {
  yjsData: Map<any> | null;
  valtioSceneData: Plugin | null;
  traverser:
    | ((traverseFunction: TraverseFunction<Plugin<T>, any>) => Map<any>)
    | null;
};

const initialData: PluginDataProviderType<any> = {
  yjsData: null,
  valtioSceneData: null,
  traverser: null,
};

export const PluginDataContext =
  createContext<PluginDataProviderType<any>>(initialData);

export function PluginDataProvider<T = any>({
  children,
  yjsData,
}: React.PropsWithChildren<{
  yjsData: Map<any>;
}>) {
  const [valtioSceneData, setValtioSceneData] = useState<Plugin | null>(null);

  useEffect(() => {
    const valtioSceneData = proxy({} as Plugin);
    const unbind = bind(valtioSceneData, yjsData);

    setValtioSceneData(valtioSceneData);

    return () => {
      unbind();
    };
  }, []);

  const traverser = useCallback(createTraverser<Plugin<T>>(yjsData!), []);

  return (
    <PluginDataContext.Provider
      value={{
        valtioSceneData,
        yjsData,
        traverser,
      }}
    >
      {!!valtioSceneData && children}
    </PluginDataContext.Provider>
  );
}

export function getTypedProviderHelperFunctions<T = any>() {
  return {
    usePluginDataContext<O = undefined>(): PluginDataProviderType<
      O extends undefined ? T : O
    > {
      return useContext(PluginDataContext);
    },
    useValtioSceneData<O = undefined>() {
      const pluginDataContext = useContext(PluginDataContext);
      return pluginDataContext.valtioSceneData! as Plugin<
        O extends undefined ? T : O
      >;
    },
    useSceneData<Y extends Record<string, any> = any>(fn: (x: Plugin<T>) => Y) {
      const pluginDataContext = useContext(PluginDataContext);
      return useY(pluginDataContext.traverser!(fn)) as Y;
    },
  };
}

// TODO: Revisit the types for this function
type TraverseFunction<T, Y = any> = (x: T) => Y;
function createTraverser<T = any>(yData: Map<any>) {
  return (traverseFunction: TraverseFunction<T>): Map<any> => {
    const originalValue = Symbol("originalValue");

    const handler = {
      get(target: any, key: any): any {
        if (key === originalValue) {
          return target;
        }

        return new Proxy(target.get(key), handler);
      },
    };

    const proxy = new Proxy(yData, handler);

    return traverseFunction(proxy)[originalValue];
  };
}
