import { type Monitor, desktop } from "@repo/desktop-bridge";
import { usePluginMetaData } from "@repo/shared";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  OverlayToggle,
  useOverlayToggle,
} from "@repo/ui";
import { cx } from "class-variance-authority";
import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { useSearch } from "wouter";

import { useRendererSelection } from "../../../contexts/rendererSelection";
import { onPresentClick } from "./desktopPresent";
import { useAvailableMonitors } from "./useAvailableMonitors";
import { usePresentingRenderers } from "./usePresentingRenderers";

const monitorKey = (monitor: Monitor) =>
  monitor.id ?? `${monitor.name}@${monitor.x},${monitor.y}`;

const orientation = (monitor: Monitor) =>
  monitor.height > monitor.width ? "Portrait" : "Landscape";

const useNewMonitorKeys = (monitors: Monitor[] | undefined) => {
  const seen = useRef<Set<string> | null>(null);
  if (!monitors) return new Set<string>();
  if (!seen.current) seen.current = new Set(monitors.map(monitorKey));
  return new Set(
    monitors.map(monitorKey).filter((key) => !seen.current!.has(key)),
  );
};

const MonitorBadges = ({
  monitor,
  isNew,
}: {
  monitor: Monitor;
  isNew: boolean;
}) => (
  <>
    {isNew && (
      <span className="rounded bg-fill-success px-1.5 py-0.5 text-[10px] font-medium text-fill-success-fg">
        New
      </span>
    )}
    {monitor.isCurrent && (
      <span className="rounded bg-fill-muted px-1.5 py-0.5 text-[10px] font-medium text-fill-muted-fg">
        This window
      </span>
    )}
    {monitor.isPrimary && (
      <span className="rounded bg-fill-muted px-1.5 py-0.5 text-[10px] font-medium text-fill-muted-fg">
        Primary
      </span>
    )}
  </>
);

const MonitorLayout = ({
  monitors,
  newKeys,
  highlighted,
  onHighlight,
  onSelect,
  disabled,
}: {
  monitors: Monitor[];
  newKeys: Set<string>;
  highlighted: string | null;
  onHighlight: (key: string | null) => void;
  onSelect: (monitor: Monitor) => void;
  disabled: boolean;
}) => {
  const minX = Math.min(...monitors.map((m) => m.x));
  const minY = Math.min(...monitors.map((m) => m.y));
  const width = Math.max(...monitors.map((m) => m.x + m.width)) - minX;
  const height = Math.max(...monitors.map((m) => m.y + m.height)) - minY;

  return (
    <div
      className="flex h-56 w-full items-center justify-center rounded-md bg-surface-secondary p-4"
      style={{ containerType: "size" }}
    >
      <div
        className="relative"
        style={{
          width: `min(100cqw, calc(100cqh * ${width / height}))`,
          aspectRatio: `${width} / ${height}`,
        }}
      >
        {monitors.map((monitor) => {
          const key = monitorKey(monitor);
          const isNew = newKeys.has(key);
          return (
            <div
              key={key}
              className="absolute p-0.5"
              style={{
                left: `${((monitor.x - minX) / width) * 100}%`,
                top: `${((monitor.y - minY) / height) * 100}%`,
                width: `${(monitor.width / width) * 100}%`,
                height: `${(monitor.height / height) * 100}%`,
              }}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(monitor)}
                onMouseEnter={() => onHighlight(key)}
                onMouseLeave={() => onHighlight(null)}
                onFocus={() => onHighlight(key)}
                onBlur={() => onHighlight(null)}
                title={`${monitor.name} · ${monitor.width}×${monitor.height}`}
                data-testid="present-monitor-layout-item"
                className={cx([
                  "flex h-full w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded border-2 bg-surface-primary px-1 text-center transition-colors cursor-pointer focus:outline-none disabled:cursor-wait",
                  highlighted === key
                    ? "border-accent bg-surface-primary-hover"
                    : "border-stroke",
                  isNew && "ring-2 ring-fill-success",
                ])}
              >
                <span className="text-2xl font-semibold leading-none">
                  {monitor.index + 1}
                </span>
                <span className="w-full truncate text-xs font-medium">
                  {monitor.name}
                </span>
                <span className="w-full truncate text-[10px] text-tertiary">
                  {monitor.width}×{monitor.height}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PresentMonitorModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();

  const { data: monitors, isLoading, isError } = useAvailableMonitors();
  const { data: presenting, refetch: refetchPresenting } =
    usePresentingRenderers();
  const newKeys = useNewMonitorKeys(monitors);

  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { orgSlug, projectSlug } = usePluginMetaData();
  const search = useSearch();
  const { selectedRendererId } = useRendererSelection();
  const isPresenting = (presenting ?? []).includes(selectedRendererId);

  const handleSelect = async (monitor: Monitor) => {
    setBusy(true);
    try {
      await onPresentClick(
        orgSlug,
        projectSlug,
        monitor,
        search,
        selectedRendererId,
      );
      await refetchPresenting();
      onToggle?.();
    } catch {
      toast.error(`Failed to present on ${monitor.name}`);
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    await desktop.stopPresenting(selectedRendererId);
    await refetchPresenting();
  };

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Select monitor</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {isLoading && (
            <p className="py-8 text-center text-sm text-tertiary">
              Detecting displays…
            </p>
          )}
          {(isError || (!isLoading && !monitors?.length)) && (
            <p className="py-8 text-center text-sm text-tertiary">
              No displays detected.
            </p>
          )}
          {!!monitors?.length && (
            <div className="flex flex-col gap-3">
              <MonitorLayout
                monitors={monitors}
                newKeys={newKeys}
                highlighted={highlighted}
                onHighlight={setHighlighted}
                onSelect={handleSelect}
                disabled={busy}
              />
              <ul className="flex flex-col">
                {monitors.map((monitor) => {
                  const key = monitorKey(monitor);
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSelect(monitor)}
                        onMouseEnter={() => setHighlighted(key)}
                        onMouseLeave={() => setHighlighted(null)}
                        data-testid="present-monitor-list-item"
                        className={cx([
                          "flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm transition-colors cursor-pointer focus:outline-none disabled:cursor-wait",
                          highlighted === key && "bg-surface-primary-hover",
                        ])}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-stroke text-xs font-semibold">
                          {monitor.index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {monitor.name}
                          </span>
                          <span className="block text-xs text-tertiary">
                            {monitor.width}×{monitor.height} ·{" "}
                            {orientation(monitor)}
                          </span>
                        </span>
                        <span className="flex shrink-0 gap-1">
                          <MonitorBadges
                            monitor={monitor}
                            isNew={newKeys.has(key)}
                          />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {isPresenting && (
            <Button variant="outline" onClick={handleStop}>
              Stop presenting
            </Button>
          )}
          <Button variant="outline" onClick={() => onToggle?.()}>
            Cancel
          </Button>
        </DialogFooter>
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
  const { data: presenting, refetch: refetchPresenting } =
    usePresentingRenderers();
  const { selectedRendererId } = useRendererSelection();

  const isPresenting = (presenting ?? []).includes(selectedRendererId);

  return (
    <>
      <OverlayToggle
        isLazy
        toggler={({ onToggle }) => <PresentButtonElement onClick={onToggle} />}
      >
        <PresentMonitorModal />
      </OverlayToggle>

      {isPresenting && (
        <StopPresentButtonElement
          onClick={async () => {
            await desktop.stopPresenting(selectedRendererId);
            await refetchPresenting();
          }}
        />
      )}
    </>
  );
};

export default PresentMonitorModalWrapper;
