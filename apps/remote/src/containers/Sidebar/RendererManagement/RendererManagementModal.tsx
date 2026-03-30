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
  useOverlayToggle,
} from "@repo/ui";
import { useCallback, useMemo, useState } from "react";
import { VscAdd } from "react-icons/vsc";

import { useRendererSelection } from "../../../contexts/rendererSelection";
import RendererCard from "./RendererCard";

const RendererManagementModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();

  const data = useData();
  const mainState = usePluginData().mainState!;
  const { selectedRendererId, setSelectedRendererId } = useRendererSelection();

  const [layoutEditorRendererId, setLayoutEditorRendererId] = useState<
    string | null
  >(null);

  const rendererIds = useMemo(
    () => Object.keys(data.renderer).sort(),
    [data.renderer],
  );

  const handleAddRenderer = useCallback(() => {
    const numericIds = rendererIds
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id));
    const nextId = Math.max(0, ...numericIds) + 1;
    const newId = String(nextId);

    mainState.renderer[newId] = {
      currentScene: null,
      overlay: null,
      children: {},
      layout: null,
      ownedScenes: {},
    } satisfies RenderData;
  }, [mainState.renderer, rendererIds]);

  const handleDeleteRenderer = useCallback(
    (rendererId: string) => {
      if (rendererId === "1") return;

      if (selectedRendererId === rendererId) {
        setSelectedRendererId("1");
      }

      delete mainState.renderer[rendererId];
    },
    [mainState.renderer, selectedRendererId, setSelectedRendererId],
  );

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="3xl">
        <DialogHeader>
          <DialogTitle>Manage Renderers</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4 py-2">
            <p className="text-sm text-secondary">
              Renderers are independent display outputs. Each renderer can show
              different scenes or use custom layouts for confidence monitors.
            </p>

            <div className="flex flex-wrap gap-4">
              {rendererIds.map((rendererId) => (
                <RendererCard
                  key={rendererId}
                  rendererId={rendererId}
                  renderer={data.renderer[rendererId] as RenderData}
                  stateData={data.data}
                  onDelete={handleDeleteRenderer}
                  onOpenLayoutEditor={setLayoutEditorRendererId}
                />
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
