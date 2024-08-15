import {
  IDisposable,
  KeyPressType,
  ObjectToTypedMap,
  Plugin,
  PluginContext,
} from "../types";

export type RegisterOnPluginDataCreated<PluginDataType = any> = (
  entryData: ObjectToTypedMap<Plugin<PluginDataType>>,
  pluginContext: PluginContext,
) => IDisposable;

export type RegisterOnPluginDataLoaded<PluginDataType = any> = (
  entryData: ObjectToTypedMap<Plugin<PluginDataType>>,
  pluginContext: PluginContext,
) => IDisposable;

export type RegisterKeyPressHandlerCallback<
  PluginDataType = any,
  RendererDataType = any,
> = (
  keyType: KeyPressType,
  data: {
    pluginData: ObjectToTypedMap<PluginDataType>;
    rendererData: ObjectToTypedMap<RendererDataType>;
    pluginContext: PluginContext;
  },
  next: () => void,
) => void;
