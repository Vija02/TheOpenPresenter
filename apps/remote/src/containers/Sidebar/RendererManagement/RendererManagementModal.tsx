import { RenderData } from "@repo/base-plugin";
import { useData, usePluginData } from "@repo/shared";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  PopConfirm,
  useOverlayToggle,
} from "@repo/ui";
import { useCallback, useMemo } from "react";
import { VscAdd, VscTrash } from "react-icons/vsc";

import { useRendererSelection } from "../../../contexts/rendererSelection";

const RendererManagementModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();

  const data = useData();
  const mainState = usePluginData().mainState!;
  const { selectedRendererId, setSelectedRendererId } = useRendererSelection();

  const rendererIds = useMemo(
    () => Object.keys(data.renderer).sort(),
    [data.renderer],
  );

  const handleAddRenderer = useCallback(() => {
    // Find the next available numeric ID
    const numericIds = rendererIds
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id));
    const nextId = Math.max(0, ...numericIds) + 1;
    const newId = String(nextId);

    // Create new renderer with default state
    mainState.renderer[newId] = {
      currentScene: null,
      overlay: null,
      children: {},
    } satisfies RenderData;
  }, [mainState.renderer, rendererIds]);

  const handleDeleteRenderer = useCallback(
    (rendererId: string) => {
      // Don't allow deleting the main renderer
      if (rendererId === "1") return;

      // If the deleted renderer was selected, switch to "1"
      if (selectedRendererId === rendererId) {
        setSelectedRendererId("1");
      }

      delete mainState.renderer[rendererId];
    },
    [mainState.renderer, selectedRendererId, setSelectedRendererId],
  );

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Manage Renderers</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="stack-col gap-2 py-2">
            <p className="text-sm text-muted-foreground">
              Renderers are independent display outputs. Each renderer can show
              a different scene.
            </p>
            <div className="stack-col gap-1">
              {rendererIds.map((rendererId) => (
                <div
                  key={rendererId}
                  className="flex items-center justify-between p-2 rounded border"
                >
                  <span className="font-medium">
                    Screen {rendererId}
                    {rendererId === "1" && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (Main)
                      </span>
                    )}
                  </span>
                  {rendererId !== "1" && (
                    <PopConfirm
                      title="Delete Renderer"
                      description={`Are you sure you want to delete Screen ${rendererId}?`}
                      onConfirm={() => handleDeleteRenderer(rendererId)}
                    >
                      <Button size="sm" variant="ghost">
                        <VscTrash />
                      </Button>
                    </PopConfirm>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddRenderer}
              className="w-full"
            >
              <VscAdd /> Add New Renderer
            </Button>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onToggle}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RendererManagementModal;
