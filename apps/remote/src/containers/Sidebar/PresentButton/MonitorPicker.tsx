import { type Monitor, desktop, displayKey } from "@repo/desktop-bridge";
import { Button } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { cx } from "class-variance-authority";
import { useRef, useState } from "react";
import { MdMonitor } from "react-icons/md";

import { useAvailableMonitors } from "./useAvailableMonitors";
import { useShowingOnDisplays } from "./useShowingOnDisplays";

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

const Badge = ({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "success" | "live";
}) => (
  <span
    className={cx(
      "rounded px-1.5 py-0.5 text-[10px] font-medium",
      tone === "live"
        ? "bg-fill-destructive text-fill-destructive-fg"
        : tone === "success"
          ? "bg-fill-success text-fill-success-fg"
          : "bg-fill-muted text-fill-muted-fg",
    )}
  >
    {children}
  </span>
);

const MonitorLayout = ({
  monitors,
  newKeys,
  highlighted,
  onHighlight,
  onSelect,
  disabled,
  showingOn,
}: {
  showingOn: Record<string, string[]>;
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
      className="flex h-44 w-full items-center justify-center rounded-md bg-surface-secondary p-4"
      style={{ containerType: "size" }}
      aria-hidden="true"
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
          const showing = showingOn[displayKey(monitor)];
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
                tabIndex={-1}
                disabled={disabled}
                onClick={() => onSelect(monitor)}
                onMouseEnter={() => onHighlight(key)}
                onMouseLeave={() => onHighlight(null)}
                title={`${monitor.name} · ${monitor.width}×${monitor.height}`}
                data-testid="present-monitor-layout-item"
                className={cx([
                  "relative flex h-full w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded border-2 bg-surface-primary px-1 text-center transition-colors cursor-pointer focus:outline-none disabled:cursor-wait",
                  highlighted === key
                    ? "border-accent bg-surface-primary-hover"
                    : "border-stroke",
                  newKeys.has(key) && "ring-2 ring-fill-success",
                ])}
              >
                {showing && (
                  <span
                    className="absolute right-1.5 top-1.5 size-2 rounded-full bg-fill-destructive"
                    aria-hidden="true"
                  />
                )}
                <span className="w-full truncate text-sm font-medium">
                  {monitor.name}
                </span>
                {showing && (
                  <span className="w-full truncate text-[10px] font-medium text-fill-destructive">
                    {showing.join(", ")}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MonitorList = ({
  onSelect,
  busy,
}: {
  onSelect: (monitor: Monitor) => void;
  busy: boolean;
}) => {
  const { data: monitors, isLoading, isError } = useAvailableMonitors();
  const showingOn = useShowingOnDisplays();
  const newKeys = useNewMonitorKeys(monitors);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const isBrowser = !desktop.isDesktop;

  if (isLoading) {
    return (
      <p className="py-6 text-center text-sm text-tertiary">
        {isBrowser
          ? "Looking for displays… If your browser asks, click Allow."
          : "Looking for displays…"}
      </p>
    );
  }
  if (isError && isBrowser) {
    return (
      <p className="py-4 text-sm text-secondary">
        Your browser didn't let us see your displays. Turn on “Window
        management” in this site's settings, or use a new window below.
      </p>
    );
  }
  if (isError || !monitors || monitors.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-tertiary">
        No displays found.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {monitors.length > 1 && (
        <MonitorLayout
          showingOn={showingOn}
          monitors={monitors}
          newKeys={newKeys}
          highlighted={highlighted}
          onHighlight={setHighlighted}
          onSelect={onSelect}
          disabled={busy}
        />
      )}
      <ul className="flex flex-col">
        {monitors.map((monitor) => {
          const key = monitorKey(monitor);
          return (
            <li key={key}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onSelect(monitor)}
                onMouseEnter={() => setHighlighted(key)}
                onMouseLeave={() => setHighlighted(null)}
                onFocus={() => setHighlighted(key)}
                onBlur={() => setHighlighted(null)}
                data-testid="present-monitor-list-item"
                className={cx([
                  "flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm transition-colors cursor-pointer focus:outline-none disabled:cursor-wait",
                  highlighted === key && "bg-surface-primary-hover",
                ])}
              >
                <MdMonitor
                  className={cx(
                    "size-5 shrink-0 text-tertiary",
                    orientation(monitor) === "Portrait" && "rotate-90",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {monitor.name}
                  </span>
                  <span className="block text-xs text-tertiary">
                    {monitor.width}×{monitor.height} · {orientation(monitor)}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  {showingOn[displayKey(monitor)]?.map((outputName) => (
                    <Badge key={outputName} tone="live">
                      {outputName}
                    </Badge>
                  ))}
                  {newKeys.has(key) && <Badge tone="success">New</Badge>}
                  {monitor.isCurrent && <Badge>This window</Badge>}
                  {monitor.isPrimary && <Badge>Primary</Badge>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {monitors.length === 1 && (
        <p className="px-3 text-xs text-tertiary">
          Only one display found. Connect your projector or TV and it will show
          up here.
        </p>
      )}
    </div>
  );
};

/** In a browser, only asks for permission when the user clicks */
export const MonitorPicker = (props: {
  onSelect: (monitor: Monitor) => void;
  busy: boolean;
}) => {
  const isBrowser = !desktop.isDesktop;
  const { data: permission } = useQuery({
    queryKey: ["windowManagementPermission"],
    queryFn: () => desktop.windowManagementPermission(),
    enabled: isBrowser,
  });
  const [asked, setAsked] = useState(false);

  if (isBrowser && !asked && permission !== "granted") {
    if (permission === undefined) return null;
    return (
      <div className="flex flex-col items-start gap-2 rounded-md border border-stroke p-3">
        <p className="text-sm text-secondary">
          Pick your projector or TV and we'll open the presentation on it. Your
          browser will ask to see your displays first.
        </p>
        <Button size="sm" onClick={() => setAsked(true)}>
          <MdMonitor />
          Find my displays
        </Button>
      </div>
    );
  }

  return <MonitorList {...props} />;
};
