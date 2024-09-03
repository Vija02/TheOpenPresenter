import React, { createContext, useContext, useEffect, useState } from "react";

import { AwarenessContext, PluginContext } from "..";
import { initPluginApi } from "./initPluginApi";

type InitPluginApiFunc = typeof initPluginApi<any, any>;

type PluginAPIProviderType = {
  pluginAPI: ReturnType<InitPluginApiFunc> | null;
};

const initialData: PluginAPIProviderType = {
  pluginAPI: null,
};

export const PluginAPIContext =
  createContext<PluginAPIProviderType>(initialData);

export const PluginAPIProvider = ({
  yjsPluginSceneData,
  yjsPluginRendererData,
  awarenessContext,
  pluginContext,
  setRenderCurrentScene,
  children,
}: {
  yjsPluginSceneData: any;
  yjsPluginRendererData: any;
  awarenessContext: AwarenessContext;
  pluginContext: PluginContext;
  setRenderCurrentScene: () => void;
  children: React.ReactNode;
}) => {
  const [pluginAPI, setPluginAPI] =
    useState<ReturnType<InitPluginApiFunc> | null>(null);

  useEffect(() => {
    setPluginAPI(
      initPluginApi({
        yjsPluginSceneData,
        yjsPluginRendererData,
        awarenessContext,
        pluginContext,
        setRenderCurrentScene,
      }),
    );
  }, [
    setPluginAPI,
    yjsPluginSceneData,
    yjsPluginRendererData,
    awarenessContext,
    pluginContext,
    setRenderCurrentScene,
  ]);

  return (
    <PluginAPIContext.Provider value={{ pluginAPI }}>
      {pluginAPI && children}
    </PluginAPIContext.Provider>
  );
};
