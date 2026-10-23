import { Scene } from "@repo/base-plugin";
import { usePluginMetaData } from "@repo/shared";
import { sortBy } from "lodash-es";
import { useMemo } from "react";

import { getSceneIcon } from "../containers/MainBody/sceneIcons";

/** Looks up a scene's icon from the plugin it was created with */
export const useSceneIcon = () => {
  const { pluginMeta } = usePluginMetaData();

  return useMemo(() => {
    const iconByPlugin = new Map(
      pluginMeta && "registeredRemoteView" in pluginMeta
        ? pluginMeta.sceneCreator.map((x) => [x.pluginName, x.icon])
        : [],
    );

    return (scene: Scene) => {
      const firstPlugin = sortBy(
        Object.values(scene.children ?? {}),
        (x) => x.order,
      )[0];
      return getSceneIcon(
        firstPlugin ? iconByPlugin.get(firstPlugin.plugin) : null,
      );
    };
  }, [pluginMeta]);
};
