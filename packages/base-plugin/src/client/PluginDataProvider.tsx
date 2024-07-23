import React, { createContext, useContext, useEffect, useState } from "react";
import { proxy, useSnapshot } from "valtio";
import { bind } from "valtio-yjs";
import type { Map } from "yjs";

import { Scene } from "../types";

type PluginDataProviderType = {
  valtioSceneData: Scene | null;
  yjsData: Map<any> | null;
};

const initialData: PluginDataProviderType = {
  valtioSceneData: null,
  yjsData: null,
};

export const PluginDataContext =
  createContext<PluginDataProviderType>(initialData);

export const PluginDataProvider = ({
  children,
  yjsData,
}: React.PropsWithChildren<{
  yjsData: Map<any>;
}>) => {
  const [valtioSceneData, setValtioSceneData] = useState<Scene | null>(null);

  useEffect(() => {
    const valtioSceneData = proxy({} as Scene);
    const unbind = bind(valtioSceneData, yjsData);

    setValtioSceneData(valtioSceneData);

    return () => {
      unbind();
    };
  }, []);

  return (
    <PluginDataContext.Provider
      value={{
        valtioSceneData,
        yjsData,
      }}
    >
      {!!valtioSceneData && children}
    </PluginDataContext.Provider>
  );
};

export const usePluginData = () => {
  return useContext(PluginDataContext);
};

export function useSnapshotPluginData<T = any>() {
  const data = usePluginData();
  return useSnapshot(data.valtioSceneData! as Scene<T>);
}
export function useMutablePluginData<T = any>() {
  const data = usePluginData();
  return data.valtioSceneData! as Scene<T>;
}

export const getYJSPluginData = (ymap: Map<any>, sceneId: string) => {
  return (ymap.get("data") as Map<any>).get(sceneId) as Map<any>;
};
