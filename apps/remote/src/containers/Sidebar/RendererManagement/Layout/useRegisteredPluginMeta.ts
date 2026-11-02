import type {
  DataBinding,
  DerivationField,
  PluginSample,
} from "@repo/base-types";
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
    const sampleByPlugin = new Map<string, PluginSample>();

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
    if (pluginMeta && "registeredSamples" in pluginMeta) {
      for (const entry of pluginMeta.registeredSamples ?? []) {
        sampleByPlugin.set(entry.pluginName, entry.sample as PluginSample);
      }
    }
    if (pluginMeta && "sceneCreator" in pluginMeta) {
      for (const creator of pluginMeta.sceneCreator ?? []) {
        titleByPlugin.set(creator.pluginName, creator.title);
      }
    }

    return {
      fieldsByPlugin,
      bindingsByPlugin,
      titleByPlugin,
      looks,
      sampleByPlugin,
      samplePlugins: [...sampleByPlugin.keys()],
    };
  }, [pluginMeta]);
};
