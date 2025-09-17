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
import { useMemo } from "react";

import { onPresentClick } from "./desktopPresent";
import { useAllWindows } from "./useAllWindows";
import { useAvailableMonitors } from "./useAvailableMonitors";

const PresentMonitorModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();

  const { data: monitors } = useAvailableMonitors();
  const { refetch: refetchWindow } = useAllWindows();

  const { orgSlug, projectSlug } = usePluginMetaData();

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Select monitor</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {monitors?.map((monitor, i) => (
            <div
              key={i}
              onClick={async () => {
                await onPresentClick(orgSlug, projectSlug, i);
                setTimeout(async () => {
                  await refetchWindow();
                }, 2000);
                onToggle?.();
              }}
              className="cursor-pointer hover:bg-surface-primary-hover"
            >
              {monitor.name} | {monitor.size.width}x{monitor.size.height}
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
  const { data: allWindows, refetch: refetchWindow } = useAllWindows();
  const rendererWindow = useMemo(
    () => allWindows?.find((x) => x.label === "renderer"),
    [allWindows],
  );

  const { orgSlug, projectSlug } = usePluginMetaData();

  return (
    <>
      <OverlayToggle
        toggler={({ onToggle }) => (
          <PresentButtonElement
            onClick={() => {
              if (monitors?.length === 1) {
                onPresentClick(orgSlug, projectSlug);
              } else {
                onToggle();
              }
            }}
          />
        )}
      >
        <PresentMonitorModal />
      </OverlayToggle>

      {rendererWindow && (
        <StopPresentButtonElement
          onClick={async () => {
            await rendererWindow.close();
            await refetchWindow();
          }}
        />
      )}
    </>
  );
};

export default PresentMonitorModalWrapper;
