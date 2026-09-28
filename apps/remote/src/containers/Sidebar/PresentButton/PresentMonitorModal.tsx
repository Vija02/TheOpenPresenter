import { usePluginMetaData } from "@repo/shared";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  OverlayToggle,
  useOverlayToggle,
} from "@repo/ui";
import { useSearch } from "wouter";

import { useRendererSelection } from "../../../contexts/rendererSelection";
import { onPresentClick } from "./desktopPresent";
import { useAvailableMonitors } from "./useAvailableMonitors";
import { usePresentingRenderers } from "./usePresentingRenderers";

const PresentMonitorModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();

  const { data: monitors } = useAvailableMonitors();
  const { refetch: refetchPresenting } = usePresentingRenderers();

  const { orgSlug, projectSlug } = usePluginMetaData();
  const search = useSearch();
  const { selectedRendererId } = useRendererSelection();

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Select monitor</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {monitors?.map((monitor) => (
            <div
              key={monitor.index}
              onClick={async () => {
                await onPresentClick(
                  orgSlug,
                  projectSlug,
                  monitor.index,
                  search,
                  selectedRendererId,
                );
                await refetchPresenting();
                onToggle?.();
              }}
              className="cursor-pointer hover:bg-surface-primary-hover"
            >
              {monitor.name} | {monitor.width}x{monitor.height}
            </div>
          ))}
        </DialogBody>

        <DialogFooter></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PresentMonitorModalWrapper = ({
  PresentButtonElement,
  StopPresentButtonElement,
}: {
  PresentButtonElement: (prop: { onClick: () => void }) => React.ReactElement;
  StopPresentButtonElement: (prop: {
    onClick: () => void;
  }) => React.ReactElement;
}) => {
  const { data: monitors } = useAvailableMonitors();
  const { data: presenting, refetch: refetchPresenting } =
    usePresentingRenderers();

  const { orgSlug, projectSlug } = usePluginMetaData();
  const search = useSearch();
  const { selectedRendererId } = useRendererSelection();

  const isPresenting = (presenting ?? []).includes(selectedRendererId);

  return (
    <>
      <OverlayToggle
        toggler={({ onToggle }) => (
          <PresentButtonElement
            onClick={async () => {
              // One monitor means there is nothing to choose between.
              if (monitors?.length === 1) {
                await onPresentClick(
                  orgSlug,
                  projectSlug,
                  0,
                  search,
                  selectedRendererId,
                );
                await refetchPresenting();
              } else {
                onToggle();
              }
            }}
          />
        )}
      >
        <PresentMonitorModal />
      </OverlayToggle>

      {isPresenting && (
        <StopPresentButtonElement
          onClick={async () => {
            const { desktop } = await import("@repo/desktop-bridge");
            await desktop.stopPresenting(selectedRendererId);
            await refetchPresenting();
          }}
        />
      )}
    </>
  );
};

export default PresentMonitorModalWrapper;
