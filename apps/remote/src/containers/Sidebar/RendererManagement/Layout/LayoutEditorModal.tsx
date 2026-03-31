import {
  LayoutAspectRatio,
  LayoutItem,
  RendererLayout,
  Scene,
  SceneLayoutPosition,
  ScreenLayoutItem,
} from "@repo/base-plugin";
import { useData, usePluginData } from "@repo/shared";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { sortBy } from "lodash-es";
import { useCallback, useMemo } from "react";
import { typeidUnboxed } from "typeid-js";

import AddLayoutItems from "./AddLayoutItems";
import AspectRatioSelector from "./AspectRatioSelector";
import InteractiveLayoutEditor from "./InteractiveLayoutEditor";
import LayoutItemsList from "./LayoutItemsList";

type LayoutEditorModalProps = {
  isOpen: boolean;
  rendererId: string;
  onClose: () => void;
};

const LayoutEditorModal = ({
  isOpen,
  rendererId,
  onClose,
}: LayoutEditorModalProps) => {
  const data = useData();
  const mainState = usePluginData().mainState!;

  const rendererIds = useMemo(
    () => Object.keys(data.renderer),
    [data.renderer],
  );

  const rendererLayout = data.renderer[rendererId]!.layout!;
  const rendererLayoutItems = data.renderer[rendererId]!.layout!
    .items as LayoutItem[];
  const getMutableRenderer = useCallback(
    () => mainState.renderer[rendererId]!,
    [mainState.renderer, rendererId],
  );

  // Process stateData to get sorted scenes
  const scenes = useMemo(() => {
    return sortBy(
      Object.entries(data.data).filter(
        (entry): entry is [string, Scene] => entry[1].type === "scene",
      ),
      ([, value]) => value.order,
    ).map(([sceneId, value]) => ({
      sceneId,
      sceneName: value.name,
      order: value.order,
    }));
  }, [data.data]);

  const handleAspectRatioChange = useCallback(
    (aspectRatio: LayoutAspectRatio) => {
      const renderer = getMutableRenderer();
      renderer.layout!.aspectRatio = aspectRatio;
    },
    [getMutableRenderer],
  );

  const handleAddSceneItem = useCallback(
    (sourceRendererId: string, sceneId: string) => {
      const renderer = getMutableRenderer();
      if (!renderer.layout) return;

      const newItem: LayoutItem = {
        id: typeidUnboxed("layoutitem"),
        type: "sceneItem",
        sceneId,
        sourceRendererId,
        position: { x: 0, y: 0, width: 50, height: 50 },
        derivation: null,
        label: scenes.find((s) => s.sceneId === sceneId)?.sceneName || "Item",
      };

      renderer.layout.items.push(newItem);
    },
    [getMutableRenderer, scenes],
  );

  const handleAddScreenItem = useCallback(
    (sourceRendererId: string) => {
      const renderer = getMutableRenderer();
      if (!renderer.layout) return;

      const newItem: ScreenLayoutItem = {
        id: typeidUnboxed("layoutitem"),
        type: "screenItem",
        sourceRendererId,
        position: { x: 0, y: 0, width: 50, height: 50 },
        derivation: null,
        label: `Screen ${sourceRendererId}`,
      };

      renderer.layout.items.push(newItem);
    },
    [getMutableRenderer],
  );

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      const renderer = getMutableRenderer();
      if (!renderer.layout) return;

      const index = renderer.layout.items.findIndex(
        (item: LayoutItem) => item.id === itemId,
      );
      if (index !== -1) {
        renderer.layout.items.splice(index, 1);
      }
    },
    [getMutableRenderer],
  );

  const handlePositionChange = useCallback(
    (itemId: string, position: SceneLayoutPosition) => {
      const renderer = mainState.renderer[rendererId];
      if (!renderer?.layout?.items) return;

      const item = renderer.layout.items.find(
        (item: LayoutItem) => item.id === itemId,
      );
      if (item) {
        item.position = position;
      }
    },
    [mainState.renderer, rendererId],
  );

  const handleDerivationChange = useCallback(
    (itemId: string, offset: number | null) => {
      const renderer = mainState.renderer[rendererId];
      if (!renderer?.layout?.items) return;

      const item = renderer.layout.items.find(
        (item: LayoutItem) => item.id === itemId,
      );
      if (item) {
        item.derivation = offset !== null ? { offset } : null;
      }
    },
    [mainState.renderer, rendererId],
  );

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle>
            <button
              onClick={onClose}
              className="text-tertiary hover:text-primary mr-2"
            >
              &larr;
            </button>
            Layout Settings - Screen {rendererId}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-6 py-2">
            <AspectRatioSelector
              currentAspectRatio={rendererLayout?.aspectRatio}
              onSelect={handleAspectRatioChange}
            />

            <div className="flex flex-col gap-3 items-start w-full">
              <AddLayoutItems
                rendererId={rendererId}
                rendererIds={rendererIds}
                onAddSceneItem={handleAddSceneItem}
                onAddScreenItem={handleAddScreenItem}
              />

              <LayoutItemsList
                items={rendererLayoutItems}
                rendererId={rendererId}
                onRemove={handleRemoveItem}
                onDerivationChange={handleDerivationChange}
              />
            </div>

            <div className="flex flex-col gap-3 items-start w-full">
              <p className="font-medium text-sm">
                Layout Preview{" "}
                <span className="text-xs text-tertiary font-normal">
                  (drag to move, drag corners to resize)
                </span>
              </p>
              <InteractiveLayoutEditor
                aspectRatio={rendererLayout.aspectRatio}
                items={rendererLayoutItems}
                onItemPositionChange={handlePositionChange}
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LayoutEditorModal;
