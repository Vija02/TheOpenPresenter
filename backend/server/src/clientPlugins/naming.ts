import {
  clientPluginRemoteTag,
  clientPluginRendererTag,
  clientPluginRuntimeName,
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

/** CSS is scoped to the container, which carries the version-free plugin name. */
export const cssScopeSelector = (clientPluginId: string) =>
  `#pl-${clientPluginRuntimeName(clientPluginId)}`;

export const REMOTE_ENTRY = "remote.tsx";
export const RENDERER_ENTRY = "renderer.tsx";
export const MANIFEST_ENTRY = "manifest.ts";

export const REMOTE_JS_FILE = "remote.es.js";
export const RENDERER_JS_FILE = "renderer.es.js";
export const REMOTE_CSS_FILE = "remote.css";
export const RENDERER_CSS_FILE = "renderer.css";
