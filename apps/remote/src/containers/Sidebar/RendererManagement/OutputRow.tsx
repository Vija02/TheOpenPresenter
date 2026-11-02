import { desktop } from "@repo/desktop-bridge";
import {
  MAIN_OUTPUT_ID,
  Output,
  setHostFollowOverlay,
  simpleOutputInfo,
} from "@repo/layout";
import { useData, usePluginMetaData } from "@repo/shared";
import { Button, Input, OverlayToggle, PopConfirm, Switch } from "@repo/ui";
import { cx } from "class-variance-authority";
import { useId, useState } from "react";
import {
  MdCoPresent,
  MdDashboardCustomize,
  MdExpandMore,
  MdOpenInNew,
  MdOutlineCancelPresentation,
} from "react-icons/md";
import { VscTrash } from "react-icons/vsc";
import { useSearch } from "wouter";

import { PresentMonitorModal } from "../PresentButton/PresentMonitorModal";
import { usePresentingRenderers } from "../PresentButton/usePresentingRenderers";
import LookPicker from "./Looks/LookPicker";
import { OUTPUT_KINDS, kindOfLook, lookName } from "./outputKinds";
import { useOutputActions } from "./useOutputs";

type OutputRowProps = {
  outputId: string;
  output: Output;
  isExpanded: boolean;
  onToggle: () => void;
  autoFocusName?: boolean;
  onEditLayout: (outputId: string) => void;
  onManageLooks: (lookKey?: string) => void;
};

const useOutputUrl = (outputId: string, preview = false) => {
  const { orgSlug, projectSlug } = usePluginMetaData();
  const search = useSearch();
  const params = new URLSearchParams(search);
  params.set("renderer", outputId);
  if (preview) params.set("preview", "1");
  return `/render/${orgSlug}/${projectSlug}?${params.toString()}`;
};

const OutputRow = ({
  outputId,
  output,
  isExpanded,
  onToggle,
  autoFocusName,
  onEditLayout,
  onManageLooks,
}: OutputRowProps) => {
  const data = useData();
  const { editLayout, rename, setLook, deleteOutput } = useOutputActions();
  const nameId = useId();
  const bodyId = useId();

  // A simple output is edited here, without the layout editor
  const simple = simpleOutputInfo(output.layout);
  const boxId = output.layout.elements[0]?.id ?? "";
  const kind = simple ? kindOfLook(data.looks, simple.look) : "custom";
  const { icon: Icon, title: kindTitle } = OUTPUT_KINDS[kind];
  const isMain = outputId === MAIN_OUTPUT_ID;
  // Black/Clear is usually what this kind of screen does
  const usualFollowOverlay = kind !== "confidence";
  const [showAdvanced, setShowAdvanced] = useState(
    () => !!simple && simple.followOverlay !== usualFollowOverlay,
  );
  const advancedId = useId();
  const shownLook = simple ? lookName(data.looks, simple.look) : kindTitle;
  // Named after what it shows: no need to say it again
  const namedAfterLook =
    !output.name ||
    shownLook.toLowerCase().startsWith(output.name.trim().toLowerCase());

  const summary = [
    !namedAfterLook && shownLook,
    // Only when it isn't what this kind of screen usually does
    simple &&
      simple.followOverlay !== usualFollowOverlay &&
      (simple.followOverlay
        ? "goes black with Black/Clear"
        : "stays on through Black/Clear"),
    !simple &&
      `${output.layout.elements.length} item${output.layout.elements.length === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      className={cx(
        "overflow-hidden rounded-sm border bg-surface-primary transition-colors",
        isExpanded
          ? "border-stroke-emphasis"
          : "border-stroke hover:border-stroke-emphasis",
      )}
      data-testid={`output-${outputId}`}
    >
      {/* The whole header opens and closes the card */}
      <div
        onClick={onToggle}
        className="flex items-center gap-2 p-2 pl-3 transition-colors cursor-pointer hover:bg-surface-primary-hover"
      >
        <span className="flex min-w-0 flex-1 items-center gap-3 py-1">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-surface-secondary text-secondary">
            <Icon className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">
              {output.name || kindTitle}
            </span>
            {summary && (
              <span className="block truncate text-xs text-tertiary">
                {summary}
              </span>
            )}
          </span>
        </span>

        <div
          className="flex shrink-0 items-center gap-1"
          // Its buttons and dialogs don't open or close the card
          onClick={(e) => e.stopPropagation()}
        >
          {desktop.isDesktop ? (
            <DesktopPresent
              outputId={outputId}
              outputName={output.name}
              showActions={isExpanded}
            />
          ) : (
            isExpanded && (
              <OpenInTab outputId={outputId} outputName={output.name} />
            )
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-controls={bodyId}
            aria-label={`${isExpanded ? "Hide" : "Show"} settings for ${output.name}`}
            title="Settings"
          >
            <MdExpandMore
              className={cx(
                "size-5 transition-transform",
                isExpanded && "rotate-180",
              )}
            />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div
          id={bodyId}
          className="flex flex-col gap-4 border-t border-stroke p-2 sm:p-3 md:p-4"
        >
          <div className="grid gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <OutputPreview outputId={outputId} />

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor={nameId} className="text-xs font-medium">
                  Name
                </label>
                <Input
                  id={nameId}
                  value={output.name}
                  placeholder={kindTitle}
                  autoFocus={autoFocusName}
                  onFocus={(e) => autoFocusName && e.currentTarget.select()}
                  onChange={(e) => rename(outputId, e.target.value)}
                  onBlur={(e) =>
                    !e.target.value.trim() && rename(outputId, kindTitle)
                  }
                />
              </div>

              {simple ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">Look</span>
                    {/* Built-in looks are copied to change them */}
                    {!!data.looks?.[simple.look]?.base && (
                      <Button
                        variant="link"
                        size="xs"
                        className="h-auto p-0 text-xs"
                        onClick={() => onManageLooks(simple.look)}
                      >
                        Edit look
                      </Button>
                    )}
                  </div>
                  <LookPicker
                    value={simple.look}
                    onManage={() => onManageLooks()}
                    onChange={(lookKey) => {
                      setLook(outputId, boxId, lookKey);
                      // A new kind of screen does what that kind usually does
                      const nextKind = kindOfLook(data.looks, lookKey);
                      if (nextKind !== kind) {
                        editLayout(outputId, (layout) =>
                          setHostFollowOverlay(
                            layout,
                            boxId,
                            nextKind !== "confidence",
                          ),
                        );
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-start gap-2 rounded-md border border-stroke p-3">
                  <p className="text-sm">
                    This output has a custom layout. Arrange what it shows in
                    the layout editor.
                  </p>
                  <Button size="sm" onClick={() => onEditLayout(outputId)}>
                    <MdDashboardCustomize />
                    Edit layout
                  </Button>
                </div>
              )}
            </div>
          </div>

          {simple && showAdvanced && (
            <div
              id={advancedId}
              className="flex flex-col gap-3 rounded-md border border-stroke p-2 sm:p-3"
            >
              <label className="flex items-start justify-between gap-3 cursor-pointer">
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    Follow black and clear
                  </span>
                  <span className="block text-xs text-tertiary">
                    Turn this off if you want to always show the content for
                    this output
                  </span>
                </span>
                <Switch
                  checked={simple.followOverlay}
                  aria-label="Follow black and clear"
                  onCheckedChange={(checked) =>
                    editLayout(outputId, (layout) =>
                      setHostFollowOverlay(layout, boxId, checked),
                    )
                  }
                />
              </label>
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Layout</span>
                  <span className="block text-xs text-tertiary">
                    Add a timer, text or more live content around it
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  aria-label="Customize layout"
                  title="Customize layout"
                  onClick={() => onEditLayout(outputId)}
                >
                  <MdDashboardCustomize />
                  <span className="hidden sm:inline">Customize</span>
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-stroke pt-3">
            {simple && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced((shown) => !shown)}
                aria-expanded={showAdvanced}
                aria-controls={advancedId}
              >
                Advanced
                <MdExpandMore
                  className={cx(
                    "transition-transform",
                    showAdvanced && "rotate-180",
                  )}
                />
              </Button>
            )}
            <span className="flex-1" />
            {!isMain && (
              <PopConfirm
                title="Delete output"
                description={`Delete ${output.name}? Screens showing it will go blank.`}
                okText="Delete"
                onConfirm={() => deleteOutput(outputId)}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-fill-destructive"
                  aria-label={`Delete ${output.name}`}
                >
                  <VscTrash />
                  Delete
                </Button>
              </PopConfirm>
            )}
          </div>
        </div>
      )}
    </li>
  );
};

export default OutputRow;

/** What the output shows right now */
const OutputPreview = ({ outputId }: { outputId: string }) => {
  const url = useOutputUrl(outputId, true);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium">Live preview</span>
      <iframe
        src={url}
        title="Output preview"
        className="block aspect-video w-full border border-stroke bg-black"
      />
    </div>
  );
};

const OpenInTab = ({
  outputId,
  outputName,
}: {
  outputId: string;
  outputName: string;
}) => {
  const url = useOutputUrl(outputId);
  return (
    <Button asChild variant="ghost" size="sm">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title={`Open ${outputName} in a new tab, then make it fullscreen on the display`}
        aria-label={`Open ${outputName} in a new tab`}
      >
        <MdOpenInNew />
        <span className="hidden sm:inline">Open</span>
      </a>
    </Button>
  );
};

const DesktopPresent = ({
  outputId,
  outputName,
  showActions,
}: {
  outputId: string;
  outputName: string;
  /** Otherwise only whether it's on screen */
  showActions: boolean;
}) => {
  const { data: presenting, refetch } = usePresentingRenderers();
  const isPresenting = (presenting ?? []).includes(outputId);

  return (
    <>
      {isPresenting && (
        <>
          <span className="rounded bg-fill-success px-1.5 py-0.5 text-[10px] font-medium text-fill-success-fg">
            On screen
          </span>
          {showActions && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              title={`Stop showing ${outputName}`}
              aria-label={`Stop showing ${outputName}`}
              onClick={async () => {
                await desktop.stopPresenting(outputId);
                await refetch();
              }}
            >
              <MdOutlineCancelPresentation />
            </Button>
          )}
        </>
      )}
      {showActions && (
        <OverlayToggle
          isLazy
          toggler={({ onToggle }) => (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              title={`Show ${outputName} on a display`}
            >
              <MdCoPresent />
              <span className="hidden sm:inline">
                {isPresenting ? "Move" : "Present"}
              </span>
            </Button>
          )}
        >
          <PresentMonitorModal outputId={outputId} outputName={outputName} />
        </OverlayToggle>
      )}
    </>
  );
};
