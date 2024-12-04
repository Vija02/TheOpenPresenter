import React, { createContext, useEffect, useState } from "react";
import type { toast as ReactToast } from "react-toastify";

import {
  AwarenessContext,
  CanPlayAudio,
  ErrorHandler,
  PluginContext,
} from "..";
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
  misc,
  children,
}: {
  yjsPluginSceneData: any;
  yjsPluginRendererData: any;
  awarenessContext: AwarenessContext;
  pluginContext: PluginContext;
  setRenderCurrentScene: () => void;
  misc: {
    errorHandler: ErrorHandler;
    canPlayAudio: CanPlayAudio;
    toast: typeof ReactToast;
  };
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
        misc,
      }),
    );
  }, [
    setPluginAPI,
    yjsPluginSceneData,
    yjsPluginRendererData,
    awarenessContext,
    pluginContext,
    setRenderCurrentScene,
    misc,
  ]);

  return (
    <PluginAPIContext.Provider value={{ pluginAPI }}>
      {pluginAPI && children}
    </PluginAPIContext.Provider>
  );
};
