import {
  OwnedScene,
  RenderData,
  RendererLayout,
  StateData,
} from "@repo/base-plugin";
import { usePluginData } from "@repo/shared";
import { Button, Checkbox, PopConfirm } from "@repo/ui";
import { cx } from "class-variance-authority";
import { sortBy } from "lodash-es";
import { useCallback, useMemo } from "react";
import { VscEye, VscEyeClosed, VscSettings, VscTrash } from "react-icons/vsc";

import { getSceneOwnershipStatus } from "../../../util/sceneOwnership";

type RendererCardProps = {
  rendererId: string;
  renderer: RenderData;
  stateData: StateData;
  onDelete: (rendererId: string) => void;
  onOpenLayoutEditor: (rendererId: string) => void;
};

const RendererCard = ({
  rendererId,
  renderer,
  stateData,
  onDelete,
  onOpenLayoutEditor,
}: RendererCardProps) => {
  const mainState = usePluginData().mainState!;

  const hasLayout = !!renderer?.layout?.enabled;

  // Process stateData to get sorted scenes
  const scenes = useMemo(() => {
    return sortBy(
      Object.entries(stateData).filter(([, value]) => value.type === "scene"),
      ([, value]) => value.order,
    ).map(([sceneId, value]) => ({
      sceneId,
      sceneName: value.name,
    }));
  }, [stateData]);

  // Initialize ownedScenes with all scenes if null/undefined
  const ensureOwnedScenesInitialized = useCallback(() => {
    const rendererState = mainState.renderer[rendererId];
    if (!rendererState) return null;

    if (
      rendererState.ownedScenes === null ||
      rendererState.ownedScenes === undefined
    ) {
      rendererState.ownedScenes = {};
      scenes.forEach(({ sceneId }) => {
        rendererState.ownedScenes![sceneId] = {
          visible: true,
        } satisfies OwnedScene;
      });
    }

    return rendererState;
  }, [mainState.renderer, rendererId, scenes]);

  const handleToggleSceneOwnership = useCallback(
    (sceneId: string, owned: boolean) => {
      const rendererState = ensureOwnedScenesInitialized();
      if (!rendererState) return;

      if (owned) {
        rendererState.ownedScenes![sceneId] = {
          visible: true,
        } satisfies OwnedScene;
      } else {
        delete rendererState.ownedScenes![sceneId];
      }
    },
    [ensureOwnedScenesInitialized],
  );

  const handleToggleSceneVisibility = useCallback(
    (sceneId: string) => {
      const rendererState = ensureOwnedScenesInitialized();
      if (!rendererState) return;

      const owned = rendererState.ownedScenes![sceneId];
      if (!owned) return;

      owned.visible = !owned.visible;
    },
    [ensureOwnedScenesInitialized],
  );

  const handleToggleLayout = useCallback(
    (enabled: boolean) => {
      const rendererState = mainState.renderer[rendererId];
      if (!rendererState) return;

      if (enabled) {
        if (!rendererState.layout) {
          rendererState.layout = {
            enabled: true,
            aspectRatio: { width: 16, height: 9 },
            items: [],
          } satisfies RendererLayout;
        } else {
          rendererState.layout.enabled = true;
        }
      } else {
        if (rendererState.layout) {
          rendererState.layout.enabled = false;
        }
      }
    },
    [mainState.renderer, rendererId],
  );

  return (
    <div className="border rounded p-4 flex flex-col gap-3 flex-1 min-w-[280px]">
      <div className="flex items-center justify-between">
        <span className="font-medium text-base">
          Screen {rendererId}
          {rendererId === "1" && (
            <span className="ml-1 text-xs text-tertiary font-normal">
              (Main)
            </span>
          )}
        </span>
        {rendererId !== "1" && (
          <PopConfirm
            title="Delete Renderer"
            description={`Are you sure you want to delete Screen ${rendererId}?`}
            onConfirm={() => onDelete(rendererId)}
          >
            <Button
              size="icon"
              variant="ghost"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 w-7"
            >
              <VscTrash className="w-3.5 h-3.5" />
            </Button>
          </PopConfirm>
        )}
      </div>

      <div className="flex flex-col gap-1 max-h-[250px] overflow-y-auto">
        {scenes.map(({ sceneId, sceneName }) => {
          const { owned, visible } = getSceneOwnershipStatus(
            renderer.ownedScenes,
            sceneId,
          );

          return (
            <div
              key={sceneId}
              className={cx(
                "flex items-center gap-2 py-1.5 px-2 rounded w-full",
                owned ? "bg-surface-secondary" : "opacity-60",
              )}
            >
              <Checkbox
                checked={owned}
                onCheckedChange={(checked) =>
                  handleToggleSceneOwnership(sceneId, checked === true)
                }
                className="flex-shrink-0"
              />
              <span className="text-sm flex-1 text-left truncate min-w-0">
                {sceneName || "Unnamed Scene"}
              </span>
              <button
                onClick={() => owned && handleToggleSceneVisibility(sceneId)}
                className={cx(
                  "p-1 rounded flex-shrink-0 w-6 h-6 flex items-center justify-center",
                  owned ? "hover:bg-gray-200" : "invisible",
                  owned && !visible && "text-tertiary",
                )}
                title={visible ? "Hide scene" : "Show scene"}
              >
                {visible ? <VscEye /> : <VscEyeClosed />}
              </button>
            </div>
          );
        })}
        {scenes.length === 0 && (
          <p className="text-sm text-tertiary text-left py-2">
            No scenes available
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={hasLayout}
            onCheckedChange={(checked) => handleToggleLayout(checked === true)}
          />
          Use custom layout
        </label>
        {hasLayout && (
          <Button
            size="xs"
            variant="outline"
            onClick={() => onOpenLayoutEditor(rendererId)}
          >
            <VscSettings className="mr-1" />
            Configure
          </Button>
        )}
      </div>
    </div>
  );
};

export default RendererCard;
