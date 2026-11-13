import { desktop } from "@repo/desktop-bridge";
import { MAIN_OUTPUT_ID, sortedOutputIds } from "@repo/layout";
import { useData } from "@repo/shared";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui";
import { cx } from "class-variance-authority";
import {
  MdClose,
  MdDevices,
  MdFullscreen,
  MdLinkOff,
  MdMonitor,
  MdPhoneIphone,
  MdTab,
  MdTv,
  MdWeb,
} from "react-icons/md";
import { toast } from "react-toastify";

import { usePresentHere } from "../../../contexts/presentHere";
import { OUTPUT_KINDS, outputKind } from "../RendererManagement/outputKinds";
import { useOutputs } from "../RendererManagement/useOutputs";
import { usePresentedOn } from "./presentedOn";
import { useOutputName } from "./useOutputName";
import { useOutputPresences } from "./useOutputPresences";
import { usePresentStatus } from "./usePresentStatus";
import { useVirtualScreens } from "./useVirtualScreens";

type Action = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "destructive";
};

type Destination = {
  key: string;
  icon: React.ReactNode;
  label: string;
  detail?: string;
  actions: Action[];
  whyNot?: string;
  children?: Destination[];
};

const closeAction = (label: string, onClick: () => void): Action => ({
  label,
  icon: <MdClose />,
  onClick,
  tone: "destructive",
});

/** Where each output is showing, on any device */
const useDestinations = () => {
  const nameOf = useOutputName();
  const { statusOf, stop, closeWindow, displayOutputIds } = usePresentStatus();
  const monitorNames = usePresentedOn();
  const presentHere = usePresentHere();
  const virtual = useVirtualScreens();
  const { presences, close } = useOutputPresences();

  return (outputId: string): Destination[] => {
    const outputName = nameOf(outputId);
    const own = presences.filter((p) => p.outputId === outputId);
    const localIds = new Set(statusOf(outputId).windows.map((w) => w.id));
    const studioHere = desktop.isDesktop && displayOutputIds.includes(outputId);
    const list: Destination[] = [];

    const studio = own.filter((p) => p.where === "studio");
    for (const p of studio) {
      const isMine = p.isLocal && studioHere;
      const name = p.screenName ?? (isMine ? monitorNames[outputId] : null);
      list.push({
        key: p.windowId,
        icon: <MdMonitor />,
        label: name || "A display",
        detail: p.isLocal ? undefined : (p.machine ?? undefined),
        actions: [
          closeAction(`Close ${outputName} on ${name || "the display"}`, () =>
            isMine ? void stop(outputId) : close([p.windowId]),
          ),
        ],
      });
    }
    // Before it has reported in
    if (studioHere && !studio.some((p) => p.isLocal)) {
      const name = monitorNames[outputId];
      list.push({
        key: "studio",
        icon: <MdMonitor />,
        label: name || "A display",
        actions: [
          closeAction(
            `Close ${outputName} on ${name || "the display"}`,
            () => void stop(outputId),
          ),
        ],
      });
    }

    const windows = own
      .filter((p) => p.where === "window" || p.where === "tab")
      .sort(
        (a, b) =>
          (a.where === "window" ? 0 : 1) - (b.where === "window" ? 0 : 1),
      );
    for (const p of windows) {
      const kind = `${p.browser} ${p.where}`;
      const onDisplay = p.screenName !== null;
      const isLocal = localIds.has(p.windowId);
      const actions: Action[] = [];
      if (
        !p.fullscreen &&
        isLocal &&
        p.where === "window" &&
        desktop.canMakeWindowFullscreen &&
        desktop.hasWindow(outputId, p.windowId)
      ) {
        actions.push({
          label: "Make fullscreen",
          icon: <MdFullscreen />,
          onClick: () => {
            if (!desktop.requestWindowFullscreen(outputId, p.windowId)) {
              toast.info(
                `Click “Go fullscreen” on the ${outputName} window instead.`,
              );
            }
          },
        });
      }
      if (p.canClose) {
        actions.push(
          closeAction(
            onDisplay && p.where === "window"
              ? `Close ${outputName} on ${p.screenName}`
              : `Close the ${kind}`,
            () => (isLocal ? closeWindow(p.windowId) : close([p.windowId])),
          ),
        );
      }
      list.push({
        key: p.windowId,
        icon:
          p.where === "tab" ? <MdTab /> : onDisplay ? <MdMonitor /> : <MdWeb />,
        label: p.screenName ?? kind,
        detail: !onDisplay
          ? (p.machine ?? undefined)
          : p.where === "tab"
            ? [kind, p.machine].filter(Boolean).join(" · ")
            : undefined,
        actions,
        whyNot: p.canClose ? undefined : "Close it from the browser",
      });
    }

    for (const p of own.filter((p) => p.where === "here")) {
      const isMine = presentHere.outputId === outputId;
      list.push({
        key: p.windowId,
        icon: <MdPhoneIphone />,
        label: isMine ? "This screen" : "A remote's screen",
        detail: "Shown over the remote",
        actions: isMine
          ? [closeAction("Stop showing it on this screen", presentHere.stop)]
          : [],
        whyNot: isMine ? undefined : "Stop it on that device",
      });
    }

    // Virtual screens show Main
    if (outputId === MAIN_OUTPUT_ID) {
      for (const screen of virtual.liveScreens) {
        const devices = presences.filter(
          (p) => p.where === "virtual" && p.virtualScreenId === screen.id,
        );
        list.push({
          key: `virtual-${screen.id}`,
          icon: <MdTv />,
          label: screen.name,
          detail:
            devices.length > 0
              ? "Virtual screen"
              : "Virtual screen · Not open on any device",
          children: devices.map((p) => ({
            key: p.windowId,
            icon: <MdDevices />,
            label: p.machine ?? p.browser,
            detail: p.machine ? p.browser : undefined,
            actions: [],
          })),
          actions: [
            {
              label: `Unassign ${screen.name}`,
              icon: <MdLinkOff />,
              onClick: () => void virtual.unassign(screen.id, screen.name),
              tone: "destructive",
            },
          ],
        });
      }
    }

    return list;
  };
};

const BRANCH_INDENT = "ml-[1.2rem]";

export const OutputTree = ({
  outputId,
  onChange,
}: {
  outputId: string;
  onChange: (outputId: string) => void;
}) => {
  const data = useData();
  const { outputs } = useOutputs();
  const destinationsOf = useDestinations();

  return (
    <div role="radiogroup" aria-label="What to show" className="flex flex-col">
      {sortedOutputIds(outputs).map((id) => {
        const output = outputs[id]!;
        const kind = outputKind(data.looks, output);
        const { icon: Icon, title } = OUTPUT_KINDS[kind];
        const name = output.name || title;
        const selected = id === outputId;
        const destinations = destinationsOf(id);

        return (
          <div key={id} className="pb-1">
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(id)}
              data-testid={`present-output-${id}`}
              className={cx(
                "flex w-full min-w-0 items-center gap-2 rounded-sm border px-3 py-2 text-left text-sm transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                selected
                  ? "border-accent bg-surface-primary-hover font-medium"
                  : "border-transparent hover:bg-surface-primary-hover",
              )}
            >
              <Icon className="shrink-0 text-secondary" />
              <span className="min-w-0 flex-1 truncate">{name}</span>
              {destinations.length > 0 && (
                <span
                  className="flex shrink-0 items-center gap-1 text-xs font-medium text-fill-destructive"
                  title={`On ${destinations.length} screen${destinations.length === 1 ? "" : "s"}`}
                >
                  <span className="size-2 rounded-full bg-fill-destructive" />
                  {destinations.length}
                </span>
              )}
            </button>

            {destinations.length > 0 ? (
              <ul
                className={cx(BRANCH_INDENT, "flex flex-col")}
                aria-label={`Where ${name} is showing`}
                data-testid={`present-destinations-${id}`}
              >
                {destinations.map((d, i) => (
                  <DestinationItem
                    key={d.key}
                    destination={d}
                    isLast={i === destinations.length - 1}
                  />
                ))}
              </ul>
            ) : (
              selected && (
                <p
                  className={cx(
                    BRANCH_INDENT,
                    "border-l border-stroke py-1.5 pl-3 text-xs text-tertiary",
                  )}
                >
                  Not on a screen yet
                </p>
              )
            )}
          </div>
        );
      })}
    </div>
  );
};

const actionClass =
  "flex size-7 shrink-0 items-center justify-center rounded text-tertiary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";

const DestinationItem = ({
  destination: d,
  isLast,
}: {
  destination: Destination;
  isLast: boolean;
}) => (
  <li className="relative text-sm">
    {!isLast && (
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 h-full border-l border-stroke"
      />
    )}
    <DestinationRow destination={d} />
    {d.children && d.children.length > 0 && (
      <ul className="ml-5 flex flex-col">
        {d.children.map((child, i) => (
          <DestinationItem
            key={child.key}
            destination={child}
            isLast={i === d.children!.length - 1}
          />
        ))}
      </ul>
    )}
  </li>
);

const DestinationRow = ({ destination: d }: { destination: Destination }) => (
  <div className="relative flex items-center gap-1 py-1 pl-3">
    <span
      aria-hidden="true"
      className="absolute left-0 top-0 h-1/2 border-l border-stroke"
    />
    <span
      aria-hidden="true"
      className="absolute left-0 top-1/2 w-2 border-t border-stroke"
    />

    <span className="mr-1 shrink-0 text-tertiary">{d.icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-xs font-medium" title={d.label}>
        {d.label}
      </span>
      {d.detail && (
        <span className="block truncate text-xs text-tertiary" title={d.detail}>
          {d.detail}
        </span>
      )}
    </span>

    {d.actions.map((action) => (
      <Tooltip key={action.label}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={action.onClick}
            aria-label={action.label}
            className={cx(
              actionClass,
              "cursor-pointer hover:bg-surface-primary-hover",
              action.tone === "destructive"
                ? "hover:text-fill-destructive"
                : "hover:text-primary",
            )}
          >
            {action.icon}
          </button>
        </TooltipTrigger>
        <TooltipContent>{action.label}</TooltipContent>
      </Tooltip>
    ))}

    {d.whyNot && (
      <Tooltip>
        {/* Disabled buttons don't get hover events */}
        <TooltipTrigger asChild>
          <span className="shrink-0 rounded" tabIndex={0}>
            <button
              type="button"
              disabled
              aria-label={d.whyNot}
              className={cx(actionClass, "opacity-40")}
            >
              <MdClose />
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{d.whyNot}</TooltipContent>
      </Tooltip>
    )}
  </div>
);

export const OutputSelect = ({
  outputId,
  onChange,
}: {
  outputId: string;
  onChange: (outputId: string) => void;
}) => {
  const { outputs } = useOutputs();
  const nameOf = useOutputName();

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
        Show
      </span>
      <select
        value={outputId}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-sm border border-stroke bg-surface-primary px-2 text-sm text-primary"
      >
        {sortedOutputIds(outputs).map((id) => (
          <option key={id} value={id}>
            {nameOf(id)}
          </option>
        ))}
      </select>
    </label>
  );
};
