import { PluginAPIContext } from "@repo/base-plugin/client";
import { type ReactNode, useContext, useMemo } from "react";

import { usePluginAPI } from "../../pluginApi";

export type Scene = Parameters<
  NonNullable<
    Parameters<ReturnType<typeof usePluginAPI>["scene"]["useData"]>[0]
  >
>[0];

/**
 * Draws its children from `scene` instead of the live data, when given.
 * Still subscribes to the live data, so the hooks stay the same either way.
 */
export const HeldScene = ({
  scene,
  children,
}: {
  scene: Scene | null;
  children: ReactNode;
}) => {
  const context = useContext(PluginAPIContext);

  const value = useMemo(() => {
    const pluginAPI = context.pluginAPI as ReturnType<typeof usePluginAPI>;
    if (!pluginAPI) return context;
    const liveUseData = pluginAPI.scene.useData;
    return {
      ...context,
      pluginAPI: {
        ...pluginAPI,
        scene: {
          ...pluginAPI.scene,
          useData: ((fn?: (x: Scene) => unknown) => {
            const live = liveUseData(fn);
            if (!scene) return live;
            return fn ? fn(scene) : scene;
          }) as typeof liveUseData,
        },
      },
    };
  }, [context, scene]);

  return (
    <PluginAPIContext.Provider value={value}>
      {children}
    </PluginAPIContext.Provider>
  );
};
