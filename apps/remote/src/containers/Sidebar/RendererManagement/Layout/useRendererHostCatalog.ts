import { Scene } from "@repo/base-plugin";
import { HostElement } from "@repo/layout";
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
  const { orgSlug, projectSlug } = usePluginMetaData();
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

    return { sources, previewUrl };
  }, [data.renderer, data.data, rendererId, previewUrl]);
};
