export const CPLUGIN_PREFIX = "cplugin";

export const clientPluginRuntimeName = (clientPluginId: string) =>
  `${CPLUGIN_PREFIX}-${clientPluginId}`;

export const isClientPluginName = (name: string) =>
  name.startsWith(`${CPLUGIN_PREFIX}-`);

/** The name persisted in a scene, and the base for the web component tags. */
export const clientPluginVersionName = (
  clientPluginId: string,
  versionId: string,
) => `${clientPluginRuntimeName(clientPluginId)}-${versionId}`;

export const clientPluginRemoteTag = (versionName: string) =>
  `${versionName}-remote`;

export const clientPluginRendererTag = (versionName: string) =>
  `${versionName}-renderer`;

export const findClientPluginView = <
  T extends {
    pluginName: string;
    pluginFamily: string;
    isInstallDefault: boolean;
  },
>(
  views: T[],
  storedPluginName: string | null | undefined,
): T | undefined => {
  if (!storedPluginName) return undefined;

  const exact = views.find((x) => x.pluginName === storedPluginName);
  if (exact) return exact;

  return views.find(
    (x) => x.pluginFamily === storedPluginName && x.isInstallDefault,
  );
};
