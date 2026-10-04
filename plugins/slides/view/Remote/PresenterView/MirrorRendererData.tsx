import { PluginAPIContext } from "@repo/base-plugin/client";
import { ReactNode, useMemo } from "react";

import { usePluginAPI } from "../../pluginApi";

/**
 * A second copy of the live renderer, for the speaker view. It must not report
 * loading for the scene, which the real output already does.
 */
export const MirrorRendererData = ({ children }: { children: ReactNode }) => {
  const pluginApi = usePluginAPI();

  const mirrorApi = useMemo(
    () => ({
      ...pluginApi,
      awareness: { ...pluginApi.awareness, setAwarenessStateData: () => {} },
    }),
    [pluginApi],
  );

  return (
    <PluginAPIContext.Provider value={{ pluginAPI: mirrorApi }}>
      {children}
    </PluginAPIContext.Provider>
  );
};
