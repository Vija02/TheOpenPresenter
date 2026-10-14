import { BUILT_IN_LOOK_KEYS, Scene } from "@repo/base-plugin";
import type { DataBinding, DerivationField } from "@repo/base-types";
import { HostElement, HostSource, MAIN_PROGRAM_ID } from "@repo/layout";
import { HostSourceOption, LayoutHostCatalog } from "@repo/layout/react";
import { useData, usePluginMetaData } from "@repo/shared";
import { sortBy } from "lodash-es";
import { useCallback, useMemo } from "react";
import { useSearch } from "wouter";

import { getSceneOwnershipStatus } from "../../../../util/sceneOwnership";
import { useRegisteredPluginMeta } from "./useRegisteredPluginMeta";

const programLabel = (programId: string) =>
  programId === MAIN_PROGRAM_ID
    ? "What's live"
    : `What's live on program ${programId}`;

/** What an output's layout may show: a program's live scene in a look, or any one scene */
export const useRendererHostCatalog = (outputId: string): LayoutHostCatalog => {
  const data = useData();
  const { orgSlug, projectSlug } = usePluginMetaData();
  const search = useSearch();

  const previewUrl = useCallback(
    (element: HostElement) => {
      const params = new URLSearchParams(search);
      params.set("renderer", outputId);
      params.set("preview", "1");
      params.set("hostElement", element.id);

      return `/render/${orgSlug}/${projectSlug}?${params.toString()}`;
    },
    [orgSlug, projectSlug, search, outputId],
  );

  const { fieldsByPlugin, bindingsByPlugin } = useRegisteredPluginMeta();

  /** The plugins a source covers: one, or every plugin in the scene. */
  const pluginsForSource = useCallback(
    (source: HostSource): string[] => {
      if (source.kind === "self") return [];

      if (source.kind === "screen") {
        const sceneIds = Object.keys(
          data.renderer[source.rendererId]?.children ?? {},
        );
        return sceneIds.flatMap((sceneId) =>
          Object.values(
            (data.data[sceneId] as Scene | undefined)?.children ?? {},
          ).map((p) => p.plugin),
        );
      }

      const scene = data.data[source.sceneId] as Scene | undefined;
      const plugins = Object.values(scene?.children ?? {}).map((p) => p.plugin);

      return source.kind === "plugin"
        ? plugins.filter((plugin) => plugin === source.pluginId)
        : plugins;
    },
    [data.data, data.renderer],
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
      sources.push({
        id: `screen:${sourceRendererId}`,
        label: programLabel(sourceRendererId),
        group: "Live",
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
          group:
            sourceRendererId === MAIN_PROGRAM_ID
              ? "Scenes"
              : `Scenes on program ${sourceRendererId}`,
          source: {
            kind: "scene",
            rendererId: sourceRendererId,
            sceneId,
          },
        });
      }
    }

    return {
      sources,
      previewUrl,
      derivationFields,
      dataBindings,
      looks: BUILT_IN_LOOK_KEYS,
    };
  }, [data.renderer, data.data, previewUrl, derivationFields, dataBindings]);
};
