export const CPLUGIN_PREFIX = "cplugin";

export const runtimePluginName = (clientPluginId: string, versionId: string) =>
  `${CPLUGIN_PREFIX}-${clientPluginId}-${versionId}`;

export const isClientPluginName = (name: string) =>
  name.startsWith(`${CPLUGIN_PREFIX}-`);

export const remoteTag = (runtimeName: string) => `${runtimeName}-remote`;
export const rendererTag = (runtimeName: string) => `${runtimeName}-renderer`;

export const cssScopeSelector = (runtimeName: string) => `#pl-${runtimeName}`;

export const REMOTE_ENTRY = "remote.tsx";
export const RENDERER_ENTRY = "renderer.tsx";
export const MANIFEST_ENTRY = "manifest.ts";

export const REMOTE_JS_FILE = "remote.es.js";
export const RENDERER_JS_FILE = "renderer.es.js";
export const REMOTE_CSS_FILE = "remote.css";
export const RENDERER_CSS_FILE = "renderer.css";
