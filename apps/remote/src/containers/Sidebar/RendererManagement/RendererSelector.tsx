import { useData } from "@repo/shared";
import { Button } from "@repo/ui";
import { cx } from "class-variance-authority";
import { useMemo } from "react";

import { useRendererSelection } from "../../../contexts/rendererSelection";
import { getSceneOwnershipStatus } from "../../../util/sceneOwnership";

const RendererSelector = () => {
  const data = useData();
  const { selectedRendererId, setSelectedRendererId } = useRendererSelection();

  // Get renderer IDs that have at least one owned scene
  const rendererIdsWithScenes = useMemo(() => {
    const sceneIds = Object.entries(data.data)
      .filter(([, value]) => value.type === "scene")
      .map(([id]) => id);

    return Object.keys(data.renderer)
      .sort()
      .filter((rendererId) => {
        const renderer = data.renderer[rendererId];

        return sceneIds.some(
          (sceneId) =>
            getSceneOwnershipStatus(renderer?.ownedScenes, sceneId).owned,
        );
      });
  }, [data.renderer, data.data]);

  if (rendererIdsWithScenes.length <= 1) {
    return null;
  }

  return (
    <div className="flex gap-1">
      {rendererIdsWithScenes.map((rendererId) => (
        <Button
          key={rendererId}
          size="mini"
          variant={selectedRendererId === rendererId ? "default" : "outline"}
          onClick={() => setSelectedRendererId(rendererId)}
          className={cx(
            "min-w-[28px] h-6 px-2 text-xs",
            selectedRendererId === rendererId && "font-bold",
          )}
          title={`Control Screen ${rendererId}`}
        >
          {rendererId}
        </Button>
      ))}
    </div>
  );
};

export default RendererSelector;
