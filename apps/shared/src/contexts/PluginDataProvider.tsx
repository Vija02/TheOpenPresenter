import { HocuspocusProvider } from "@hocuspocus/provider";
import type {
  AwarenessUserData,
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
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import uaParser from "ua-parser-js";
import { v4 } from "uuid";
import { proxy, useSnapshot } from "valtio";
import { bind } from "valtio-yjs";

import { useError } from "./ErrorProvider";
import { usePluginMetaData } from "./PluginMetaDataProvider";
import { useAwarenessState } from "./awarenessState";

type PluginDataProviderType = {
  provider: HocuspocusProvider | null;
  mainYMap: YState | null;
  currentUserId: string | null;
  mainState: State | null;
  rendererId: string;
  getYJSPluginSceneData: (
    sceneId: string,
    pluginId: string,
  ) => ObjectToTypedMap<Plugin> | undefined;
  getYJSPluginRendererData: (
    sceneId: string,
    pluginId: string,
    overrideRendererId?: string,
  ) => ObjectToTypedMap<Record<string, any>> | undefined;
  getYJSPluginRenderer: (
    overrideRendererId?: string,
  ) => ObjectToTypedMap<RenderData> | undefined;
};

const initialData: PluginDataProviderType = {
  provider: null,
  mainYMap: null,
  currentUserId: null,
  mainState: null,
  rendererId: "1",
  getYJSPluginSceneData: () => undefined,
  getYJSPluginRendererData: () => undefined,
  getYJSPluginRenderer: () => undefined,
};

export const PluginDataContext =
  createContext<PluginDataProviderType>(initialData);

function PluginDataProviderInner({
  children,
  provider,
  currentUserId,
  rendererId,
}: React.PropsWithChildren<{
  provider: HocuspocusProvider;
  currentUserId: string;
  rendererId: string;
}>) {
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
    (sceneId: string, pluginId: string, overrideRendererId?: string) => {
      const effectiveRendererId = overrideRendererId ?? rendererId;
      const pluginRenderData = mainYMap
        .get("renderer")
        ?.get(effectiveRendererId)
        ?.get("children")
        ?.get(sceneId)
        ?.get(pluginId);
      return pluginRenderData;
    },
    [mainYMap, rendererId],
  );
  const getYJSPluginRenderer = useCallback(
    (overrideRendererId?: string) => {
      const effectiveRendererId = overrideRendererId ?? rendererId;
      return mainYMap.get("renderer")?.get(effectiveRendererId);
    },
    [mainYMap, rendererId],
  );

  return (
    <PluginDataContext.Provider
      value={{
        provider,
        mainYMap,
        currentUserId,
        mainState,
        rendererId,
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
    // Set a timeout to reject if we can't connect
    // Due to how the provider works, some error could go uncaught
    // So this is an effort to at least show an error if that happens
    // https://github.com/ueberdosis/hocuspocus/issues/762
    const timeout = setTimeout(() => {
      reject(new Error("Unable to connect: Timeout reached"));
    }, 60000);

    const provider = new HocuspocusProvider({
      url: `${window.location.origin.replace(/^http/, "ws")}/wlink`,
      name: projectId,
      // Here only to force authentication
      token: " ",
      parameters: {
        ...appData.getProxyConfig().headers,
      },
      onAuthenticationFailed: () => {
        reject(new Error("Authentication Failed"));
      },
      onClose: (data) => {
        if (data.event.code === 401) {
          reject(new Error("Authentication Failed"));
        }
      },
      onSynced: () => {
        clearTimeout(timeout);
        resolve(provider);
      },
    });
  });
};

export const PluginDataProvider = ({
  children,
  type,
  rendererId = "1",
}: {
  children: React.ReactNode;
  type: "remote" | "renderer";
  rendererId?: string;
}) => {
  const projectId = usePluginMetaData().projectId;
  const [currentUserId] = useState(v4());

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
  const { errors } = useError();

  const uaData = useMemo(() => uaParser(), []);
  const awarenessState = useAwarenessState((x) => x.awarenessState);

  const setAwarenessData = useCallback(() => {
    provider?.setAwarenessField("user", {
      id: currentUserId,
      type,
      userAgentInfo: uaData,
      errors,
      state: awarenessState,
    } satisfies AwarenessUserData);
  }, [awarenessState, currentUserId, errors, provider, type, uaData]);
  const clearAwarenessData = useCallback(() => {
    provider?.setAwarenessField("user", null);
  }, [provider]);

  useEffect(() => {
    if (provider?.synced) {
      // Set the data
      setAwarenessData();

      addEventListener("pageshow", setAwarenessData);
      addEventListener("pagehide", clearAwarenessData);
      addEventListener("unload", clearAwarenessData);

      return () => {
        removeEventListener("pageshow", setAwarenessData);
        removeEventListener("pagehide", clearAwarenessData);
        removeEventListener("unload", clearAwarenessData);
      };
    }
  }, [
    clearAwarenessData,
    currentUserId,
    provider,
    provider?.synced,
    setAwarenessData,
  ]);

  if (isError) {
    return <ErrorAlert error={error} />;
  }
  if (isLoading || !provider) {
    return <LoadingFull />;
  }

  return (
    <PluginDataProviderInner
      provider={provider}
      currentUserId={currentUserId}
      rendererId={rendererId}
    >
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
