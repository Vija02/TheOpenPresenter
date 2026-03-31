import { useData } from "@repo/shared";
import { Button } from "@repo/ui";
import { useCallback } from "react";
import { VscAdd } from "react-icons/vsc";

import { getSceneOwnershipStatus } from "../../../../util/sceneOwnership";

type AddLayoutItemsProps = {
  rendererId: string;
  rendererIds: string[];
  onAddSceneItem: (sourceRendererId: string, sceneId: string) => void;
  onAddScreenItem: (sourceRendererId: string) => void;
};

const AddLayoutItems = ({
  rendererId,
  rendererIds,
  onAddSceneItem,
  onAddScreenItem,
}: AddLayoutItemsProps) => {
  const otherRenderers = rendererIds.filter((id) => id !== rendererId);

  const data = useData();
  const scenesWithId = Object.entries(data.data).map(([id, value]) => ({
    sceneId: id,
    ...value,
  }));

  const getOwnedScenesForRenderer = useCallback(
    (forRendererId: string) => {
      const renderer = data.renderer[forRendererId]!;

      if (renderer.ownedScenes === null || renderer.ownedScenes === undefined) {
        return scenesWithId;
      }

      return scenesWithId.filter(
        ({ sceneId }) =>
          getSceneOwnershipStatus(renderer.ownedScenes, sceneId).owned,
      );
    },
    [data.renderer, scenesWithId],
  );

  return (
    <div className="flex flex-col gap-2 items-start w-full">
      <p className="font-medium text-sm">Add Elements</p>

      {/* Screen options */}
      {otherRenderers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-tertiary min-w-[70px]">Screen:</span>
          {otherRenderers.map((sourceRendererId) => (
            <Button
              key={sourceRendererId}
              size="sm"
              variant="outline"
              onClick={() => onAddScreenItem(sourceRendererId)}
              title={`Mirror Screen ${sourceRendererId} (follows active scene)`}
            >
              <VscAdd /> Screen {sourceRendererId}
            </Button>
          ))}
        </div>
      )}

      {/* Scene options per renderer */}
      <div className="flex flex-col gap-2 w-full">
        {rendererIds.map((sourceRendererId) => {
          const ownedScenes = getOwnedScenesForRenderer(sourceRendererId);
          if (ownedScenes.length === 0) return null;

          return (
            <div
              key={sourceRendererId}
              className="flex items-center gap-2 flex-wrap"
            >
              <span className="text-xs text-tertiary min-w-[70px]">
                Screen {sourceRendererId}:
              </span>
              {ownedScenes.map(({ sceneId, name }) => (
                <Button
                  key={sceneId}
                  size="sm"
                  variant="outline"
                  onClick={() => onAddSceneItem(sourceRendererId, sceneId)}
                  title={`Add ${name}${sourceRendererId !== rendererId ? ` from Screen ${sourceRendererId}` : ""}`}
                >
                  <VscAdd /> {name}
                </Button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AddLayoutItems;
