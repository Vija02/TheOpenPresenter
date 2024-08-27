import { HocuspocusProvider } from "@hocuspocus/provider";
import type {
  ObjectToTypedMap,
  Plugin,
  RenderData,
  Scene,
  State,
  YState,
} from "@repo/base-plugin";
import { appData } from "@repo/lib";
import { ErrorAlert, LoadingFull } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { proxy, useSnapshot } from "valtio";
import { bind } from "valtio-yjs";

import { usePluginMetaData } from "./PluginMetaDataProvider";

type PluginDataProviderType = {
  mainState: State | null;
  getYJSPluginSceneData: (
    sceneId: string,
    pluginId: string,
  ) => ObjectToTypedMap<Plugin> | undefined;
  getYJSPluginRendererData: (
    sceneId: string,
    pluginId: string,
  ) => ObjectToTypedMap<Record<string, any>> | undefined;
  getYJSPluginRenderer: () => ObjectToTypedMap<RenderData> | undefined;
};

const initialData: PluginDataProviderType = {
  mainState: null,
  getYJSPluginSceneData: () => undefined,
  getYJSPluginRendererData: () => undefined,
  getYJSPluginRenderer: () => undefined,
};

export const PluginDataContext =
  createContext<PluginDataProviderType>(initialData);

function PluginDataProviderInner({
  children,
  provider,
}: React.PropsWithChildren<{ provider: HocuspocusProvider }>) {
  const [bound, setBound] = useState(false);
  const mainYMap = useMemo(
    () => provider.document.getMap() as YState,
    [provider.document],
  );

  const mainState = useMemo(() => proxy({} as State), []);

  useLayoutEffect(() => {
    const unbind = bind(mainState, mainYMap as any);
    // Binding doesn't trigger a refresh on react so we set a state to force it
    setBound(true);

    return () => {
      unbind();
    };
  }, [mainState, mainYMap]);

  const getYJSPluginSceneData: PluginDataProviderType["getYJSPluginSceneData"] =
    useCallback(
      (sceneId: string, pluginId: string) => {
        return (mainYMap.get("data")?.get(sceneId) as ObjectToTypedMap<Scene>)
          ?.get("children")
          ?.get(pluginId);
      },
      [mainYMap],
    );
  const getYJSPluginRendererData = useCallback(
    (sceneId: string, pluginId: string) => {
      const pluginRenderData = mainYMap
        .get("renderer")
        ?.get("1")
        ?.get("children")
        ?.get(sceneId)
        ?.get(pluginId);
      return pluginRenderData;
    },
    [mainYMap],
  );
  const getYJSPluginRenderer = useCallback(() => {
    return mainYMap.get("renderer")?.get("1");
  }, [mainYMap]);

  return (
    <PluginDataContext.Provider
      value={{
        mainState,
        getYJSPluginSceneData,
        getYJSPluginRendererData,
        getYJSPluginRenderer,
      }}
    >
      {bound && !!mainState.data && children}
    </PluginDataContext.Provider>
  );
}

const initializeHocuspocusProvider = (projectId: string) => {
  return new Promise<HocuspocusProvider>((resolve, reject) => {
    const provider = new HocuspocusProvider({
      url: (appData.getRootURL() + "/wlink").replace(/^http/, "ws"),
      name: projectId,
      // Here only to force authentication
      token: " ",
    });

    // Set a timeout to reject if we can't connect
    // Due to how the provider works, some error could go uncaught
    // So this is an effort to at least show an error if that happens
    // https://github.com/ueberdosis/hocuspocus/issues/762
    const timeout = setTimeout(() => {
      reject();
    }, 5000);

    const syncFunction = () => {
      clearTimeout(timeout);
      provider.off("synced", syncFunction);
      resolve(provider);
    };

    provider.on("synced", syncFunction);
  });
};

export const PluginDataProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const projectId = usePluginMetaData().projectId;

  const {
    data: provider,
    isLoading,
    error,
    isError,
  } = useQuery({
    queryKey: ["provider", projectId],
    queryFn: () => initializeHocuspocusProvider(projectId),
    retry: false,
  });
  if (isError) {
    return <ErrorAlert error={error} />;
  }
  if (isLoading || !provider) {
    return <LoadingFull />;
  }

  return (
    <PluginDataProviderInner provider={provider}>
      {children}
    </PluginDataProviderInner>
  );
};

export function usePluginData() {
  return useContext(PluginDataContext);
}

export const useData = () => {
  const mainState = usePluginData().mainState;

  return useSnapshot(mainState!);
};
