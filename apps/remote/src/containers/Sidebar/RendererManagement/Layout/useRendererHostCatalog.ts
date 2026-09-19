import { Scene } from "@repo/base-plugin";
import type { DerivationField } from "@repo/base-types";
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

  const derivationFields = useCallback(
    (source: HostSource): DerivationField[] => {
      if (source.kind === "screen") return [];

      const scene = data.data[source.sceneId] as Scene | undefined;
      const plugins = Object.values(scene?.children ?? {});

      const wanted =
        source.kind === "plugin"
          ? plugins.filter((p) => p.plugin === source.pluginId)
          : plugins;

      const out: DerivationField[] = [];
      for (const plugin of wanted) {
        for (const field of fieldsByPlugin.get(plugin.plugin) ?? []) {
          if (!out.some((existing) => existing.key === field.key)) {
            out.push(field);
          }
        }
      }
      return out;
    },
    [data.data, fieldsByPlugin],
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

    return { sources, previewUrl, derivationFields };
  }, [data.renderer, data.data, rendererId, previewUrl, derivationFields]);
};
