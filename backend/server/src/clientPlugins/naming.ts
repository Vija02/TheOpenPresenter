import {
  clientPluginRemoteTag,
  clientPluginRendererTag,
  clientPluginVersionName,
} from "@repo/lib";

export {
  CPLUGIN_PREFIX,
  clientPluginRuntimeName as runtimePluginName,
  clientPluginVersionName,
  findClientPluginView,
  isClientPluginName,
} from "@repo/lib";

// Web component tags are versioned
export const remoteTag = (clientPluginId: string, versionId: string) =>
  clientPluginRemoteTag(clientPluginVersionName(clientPluginId, versionId));

export const rendererTag = (clientPluginId: string, versionId: string) =>
  clientPluginRendererTag(clientPluginVersionName(clientPluginId, versionId));

export const cssScopeSelector = (clientPluginId: string, versionId: string) =>
  `#pl-${clientPluginVersionName(clientPluginId, versionId)}`;

export const REMOTE_ENTRY = "remote.tsx";
export const RENDERER_ENTRY = "renderer.tsx";
export const MANIFEST_ENTRY = "manifest.ts";

export const REMOTE_JS_FILE = "remote.es.js";
export const RENDERER_JS_FILE = "renderer.es.js";
export const REMOTE_CSS_FILE = "remote.css";
export const RENDERER_CSS_FILE = "renderer.css";
