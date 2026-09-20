import { Scene } from "@repo/base-plugin";
import type { DataBinding, DerivationField } from "@repo/base-types";
import { HostElement, HostSource } from "@repo/layout";
import { HostSourceOption, LayoutHostCatalog } from "@repo/layout/react";
import { useData, usePluginMetaData } from "@repo/shared";
import { sortBy } from "lodash-es";
import { useCallback, useMemo } from "react";
import { useSearch } from "wouter";

import { getSceneOwnershipStatus } from "../../../../util/sceneOwnership";

/** What this screen's layout may show: any other screen's live output, and any scene owned by any screen */
export const useRendererHostCatalog = (
  rendererId: string,
): LayoutHostCatalog => {
  const data = useData();
  const { orgSlug, projectSlug, pluginMeta } = usePluginMetaData();
  const search = useSearch();

  const previewUrl = useCallback(
    (element: HostElement) => {
      const params = new URLSearchParams(search);
      params.set("renderer", rendererId);
      params.set("preview", "1");
      params.set("hostElement", element.id);

      return `/render/${orgSlug}/${projectSlug}?${params.toString()}`;
    },
    [orgSlug, projectSlug, search, rendererId],
  );

  const fieldsByPlugin = useMemo(() => {
    const registered =
      pluginMeta && "registeredDerivationFields" in pluginMeta
        ? pluginMeta.registeredDerivationFields
        : [];

    const map = new Map<string, DerivationField[]>();
    for (const entry of registered ?? []) {
      map.set(entry.pluginName, (entry.fields ?? []) as DerivationField[]);
    }
    return map;
  }, [pluginMeta]);

  const bindingsByPlugin = useMemo(() => {
    const registered =
      pluginMeta && "registeredDataBindings" in pluginMeta
        ? pluginMeta.registeredDataBindings
        : [];

    const map = new Map<string, DataBinding[]>();
    for (const entry of registered ?? []) {
      map.set(entry.pluginName, (entry.bindings ?? []) as DataBinding[]);
    }
    return map;
  }, [pluginMeta]);

  /** The plugins a source covers: one, or every plugin in the scene. */
  const pluginsForSource = useCallback(
    (source: HostSource): string[] => {
      if (source.kind === "screen") return [];

      const scene = data.data[source.sceneId] as Scene | undefined;
      const plugins = Object.values(scene?.children ?? {}).map((p) => p.plugin);

      return source.kind === "plugin"
        ? plugins.filter((plugin) => plugin === source.pluginId)
        : plugins;
    },
    [data.data],
  );

  const derivationFields = useCallback(
    (source: HostSource): DerivationField[] => {
      const out: DerivationField[] = [];
      for (const plugin of pluginsForSource(source)) {
        for (const field of fieldsByPlugin.get(plugin) ?? []) {
          if (!out.some((existing) => existing.key === field.key)) {
            out.push(field);
          }
        }
      }
      return out;
    },
    [pluginsForSource, fieldsByPlugin],
  );

  const dataBindings = useCallback(
    (source: HostSource): DataBinding[] => {
      const out: DataBinding[] = [];
      for (const plugin of pluginsForSource(source)) {
        for (const binding of bindingsByPlugin.get(plugin) ?? []) {
          if (!out.some((existing) => existing.key === binding.key)) {
            out.push(binding);
          }
        }
      }
      return out;
    },
    [pluginsForSource, bindingsByPlugin],
  );

  return useMemo(() => {
    const rendererIds = Object.keys(data.renderer);

    const scenes = sortBy(
      Object.entries(data.data).filter(
        (entry): entry is [string, Scene] =>
          (entry[1]! as Scene).type === "scene",
      ),
      ([, scene]) => scene.order,
    );

    const sources: HostSourceOption[] = [];

    for (const sourceRendererId of rendererIds) {
      // Mirroring this screen into itself would recurse forever.
      if (sourceRendererId === rendererId) continue;
      sources.push({
        id: `screen:${sourceRendererId}`,
        label: `Screen ${sourceRendererId} (live)`,
        group: "Screens",
        source: { kind: "screen", rendererId: sourceRendererId },
      });
    }

    for (const sourceRendererId of rendererIds) {
      const ownedScenes = data.renderer[sourceRendererId]?.ownedScenes;

      for (const [sceneId, scene] of scenes) {
        if (!getSceneOwnershipStatus(ownedScenes, sceneId).owned) continue;

        sources.push({
          id: `scene:${sourceRendererId}:${sceneId}`,
          label: scene.name || "Unnamed scene",
          group: `Screen ${sourceRendererId}`,
          source: {
            kind: "scene",
            rendererId: sourceRendererId,
            sceneId,
          },
        });
      }
    }

    return { sources, previewUrl, derivationFields, dataBindings };
  }, [
    data.renderer,
    data.data,
    rendererId,
    previewUrl,
    derivationFields,
    dataBindings,
  ]);
};
