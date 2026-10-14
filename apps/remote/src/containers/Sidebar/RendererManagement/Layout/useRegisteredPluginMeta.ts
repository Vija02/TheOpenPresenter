import type { DataBinding, DerivationField } from "@repo/base-types";
import { RegisteredPluginLooks } from "@repo/layout";
import { usePluginMetaData } from "@repo/shared";
import { useMemo } from "react";

export const useRegisteredPluginMeta = () => {
  const { pluginMeta } = usePluginMetaData();

  return useMemo(() => {
    const fieldsByPlugin = new Map<string, DerivationField[]>();
    const bindingsByPlugin = new Map<string, DataBinding[]>();
    const titleByPlugin = new Map<string, string>();
    let looks: RegisteredPluginLooks = [];

    if (pluginMeta && "registeredDerivationFields" in pluginMeta) {
      for (const entry of pluginMeta.registeredDerivationFields ?? []) {
        fieldsByPlugin.set(
          entry.pluginName,
          (entry.fields ?? []) as DerivationField[],
        );
      }
    }
    if (pluginMeta && "registeredDataBindings" in pluginMeta) {
      for (const entry of pluginMeta.registeredDataBindings ?? []) {
        bindingsByPlugin.set(
          entry.pluginName,
          (entry.bindings ?? []) as DataBinding[],
        );
      }
    }
    if (pluginMeta && "registeredLooks" in pluginMeta) {
      looks = pluginMeta.registeredLooks ?? [];
    }
    if (pluginMeta && "sceneCreator" in pluginMeta) {
      for (const creator of pluginMeta.sceneCreator ?? []) {
        titleByPlugin.set(creator.pluginName, creator.title);
      }
    }

    return { fieldsByPlugin, bindingsByPlugin, titleByPlugin, looks };
  }, [pluginMeta]);
};
