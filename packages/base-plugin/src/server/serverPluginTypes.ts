import { Doc } from "yjs";

import {
  IDisposable,
  KeyPressType,
  ObjectToTypedMap,
  Plugin,
  PluginContext,
} from "../types";

export type RemoteViewWebComponentConfig = {
  /**
   * When enabled, the web component will be rendered even when the screen is not shown.
   * Pair with `pluginApi.remote.usePluginInView()` to detect when it is in view.
   */
  alwaysRender?: boolean;
};

export type RegisterOnPluginDataCreated<PluginDataType = any> = (
  entryData: ObjectToTypedMap<Plugin<PluginDataType>>,
  pluginContext: PluginContext,
) => IDisposable;

export type RegisterOnPluginDataLoaded<PluginDataType = any> = (
  entryData: ObjectToTypedMap<Plugin<PluginDataType>>,
  pluginContext: PluginContext,
) => IDisposable;

export type RegisterOnRendererDataCreated<RendererDataType = any> = (
  entryData: ObjectToTypedMap<RendererDataType>,
  pluginContext: PluginContext,
) => IDisposable;

export type RegisterOnRendererDataLoaded<RendererDataType = any> = (
  entryData: ObjectToTypedMap<RendererDataType>,
  pluginContext: PluginContext,
  extras: {
    onSceneVisibilityChange: (callback: (isVisible: boolean) => void) => void;
  },
) => IDisposable;

export type RegisterKeyPressHandlerCallback<
  PluginDataType = any,
  RendererDataType = any,
> = (
  keyType: KeyPressType,
  data: {
    pluginData: ObjectToTypedMap<PluginDataType>;
    rendererData: ObjectToTypedMap<RendererDataType>;
    document: Doc;
    pluginContext: PluginContext;
  },
  next: () => void,
) => void;
