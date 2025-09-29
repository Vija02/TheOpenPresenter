import { TypeId, toUUID } from "typeid-js";

export const uuidFromPluginIdOrUUID = (pluginIdOrUUID: string) => {
  return pluginIdOrUUID.startsWith("plugin")
    ? toUUID(pluginIdOrUUID as TypeId<string>)
    : pluginIdOrUUID;
};
