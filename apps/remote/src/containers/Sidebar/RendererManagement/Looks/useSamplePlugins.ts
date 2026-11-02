import { Scene } from "@repo/base-plugin";
import { useData } from "@repo/shared";
import { sortBy } from "lodash-es";
import { useMemo } from "react";
import { useLocation } from "wouter";

import { useRegisteredPluginMeta } from "../Layout/useRegisteredPluginMeta";

export type SamplePlugin = { pluginName: string; title: string };

export const useSamplePlugins = (): SamplePlugin[] => {
  const { samplePlugins, titleByPlugin } = useRegisteredPluginMeta();
  const data = useData();
  const [location] = useLocation();
  const scene = data.data[location.slice(1)] as Scene | undefined;

  return useMemo(() => {
    const viewed =
      scene?.type === "scene"
        ? sortBy(Object.values(scene.children ?? {}), (child) => child.order)
            .map((child) => child.plugin)
            .find((name) => samplePlugins.includes(name))
        : undefined;
    return sortBy(
      samplePlugins.filter((name) => titleByPlugin.has(name)),
      (name) => (name === viewed ? 0 : 1),
    ).map((pluginName) => ({
      pluginName,
      title: titleByPlugin.get(pluginName) ?? pluginName,
    }));
  }, [samplePlugins, titleByPlugin, scene]);
};
