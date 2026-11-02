import { MAIN_LOOK_KEY } from "@repo/base-plugin";
import { LookSummary, Outputs } from "@repo/layout";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  PopConfirm,
  Popover,
  PopoverContent,
  PopoverMenuItem,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui";
import { cx } from "class-variance-authority";
import { useId, useState } from "react";
import { MdCheckCircle, MdMoreHoriz } from "react-icons/md";
import { VscAdd, VscCopy, VscEdit, VscTrash } from "react-icons/vsc";

import { OUTPUT_KINDS, OutputKind, SIMPLE_KINDS } from "../outputKinds";
import { outputsUsingLook } from "../useOutputs";
import LookPluginList from "./LookPluginList";
import LookPreview from "./LookPreview";
import { useLooks } from "./useLooks";
import { SamplePlugin, useSamplePlugins } from "./useSamplePlugins";

type LooksModalProps = {
  isOpen: boolean;
  outputs: Outputs;
  /** The look being edited, else every look */
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onEditLook: (lookKey: string, pluginName: string) => void;
  /** Back to the outputs */
  onBack: () => void;
  onDone: () => void;
};

const LooksModal = ({
  isOpen,
  outputs,
  selectedKey,
  onSelect,
  onEditLook,
  onBack,
  onDone,
}: LooksModalProps) => {
  const { looks, createLook, duplicateLook } = useLooks();
  const samples = useSamplePlugins();
  const [samplePlugin, setSamplePlugin] = useState<string | null>(null);
  const sample =
    samples.find((entry) => entry.pluginName === samplePlugin) ??
    samples[0] ??
    null;

  // Built-in looks are copied to change them
  const selected =
    looks.find((look) => look.key === selectedKey && !look.builtIn) ?? null;

  return (
    <Dialog open={isOpen} onOpenChange={onDone}>
      <DialogContent
        size="full"
        className="desktop:w-[94vw] desktop:max-w-[1280px] desktop:h-[88vh] flex flex-col"
      >
        <DialogHeader className="px-3 pt-4 sm:px-6 sm:pt-6">
          {/* Room on the right for the close button */}
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogTitle className="min-w-0 truncate">
              <button
                type="button"
                onClick={() => (selected ? onSelect(null) : onBack())}
                className="text-tertiary hover:text-primary mr-2 cursor-pointer"
                aria-label={selected ? "Back to looks" : "Back to outputs"}
              >
                &larr;
              </button>
              {selected ? selected.name : "Looks"}
            </DialogTitle>
            {!selected && samples.length > 0 && (
              <label className="flex shrink-0 items-center gap-2 text-xs text-secondary">
                <span className="hidden sm:inline">Preview with</span>
                <select
                  aria-label="Preview with"
                  className="max-w-40 rounded-sm border border-stroke bg-surface-primary px-2 py-1 text-sm text-primary"
                  value={sample?.pluginName ?? ""}
                  onChange={(e) => setSamplePlugin(e.target.value)}
                >
                  {samples.map((entry) => (
                    <option key={entry.pluginName} value={entry.pluginName}>
                      {entry.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {!selected && (
            <p className="text-sm text-secondary">
              Create custom looks to customize how it looks on screen.
            </p>
          )}
        </DialogHeader>
        <DialogBody className="flex-1 min-h-0 px-3 sm:px-6">
          {samples.length === 0 && (
            <p className="mb-2 rounded-md bg-surface-secondary p-3 text-xs text-secondary">
              No plugin has sample content to preview with, so previews show
              what's live.
            </p>
          )}
          {selected ? (
            <LookDetail
              look={selected}
              outputs={outputs}
              onEditLook={onEditLook}
              onDeleted={() => onSelect(null)}
              onDuplicated={onSelect}
            />
          ) : (
            <div className="flex flex-col gap-6 py-2">
              {SIMPLE_KINDS.map(({ kind, lookKey: type, plural }) => {
                const Icon = OUTPUT_KINDS[kind].icon;
                const ofType = looks.filter((look) => look.type === type);
                return (
                  <section
                    key={type}
                    aria-label={plural}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-secondary" />
                      <h3 className="text-sm font-medium">{plural}</h3>
                    </div>
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {ofType.map((look) => (
                        <LookCard
                          key={look.key}
                          look={look}
                          sample={sample}
                          usedBy={outputsUsingLook(outputs, look.key)}
                          onEdit={() => onSelect(look.key)}
                          onDuplicate={() => onSelect(duplicateLook(look.key))}
                        />
                      ))}
                      <li>
                        <NewLookButton
                          title={OUTPUT_KINDS[kind].title}
                          onCreate={(name) => onSelect(createLook(type, name))}
                        />
                      </li>
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </DialogBody>
        <DialogFooter className="px-3 pb-4 sm:px-6 sm:pb-6">
          {/* Back a step: the window closes from the outputs */}
          <Button onClick={() => (selected ? onSelect(null) : onBack())}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LooksModal;

const NEW_LOOK_CLASS =
  "flex h-full min-h-32 w-full flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-stroke p-3 text-xs text-secondary transition-colors cursor-pointer hover:bg-surface-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** A new look, showing as its type's look until changed */
const NewLookButton = ({
  title,
  onCreate,
}: {
  title: string;
  onCreate: (name: string) => void;
}) => (
  <button
    type="button"
    onClick={() => onCreate(title)}
    aria-label={`New ${title.toLowerCase()} look`}
    className={NEW_LOOK_CLASS}
  >
    <VscAdd className="size-4" />
    New look
  </button>
);

/** Says on hover why what it wraps can't be used. Disabled buttons get no hover, so it wraps them */
const WhyDisabled = ({
  reason,
  children,
}: {
  reason: string | null;
  children: React.ReactNode;
}) =>
  reason ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block">{children}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{reason}</TooltipContent>
    </Tooltip>
  ) : (
    <>{children}</>
  );

const DELETE_ITEM_CLASS =
  "flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-medium text-fill-destructive transition-colors cursor-pointer hover:bg-surface-primary-hover focus-visible:bg-surface-primary-hover focus:outline-none";

const LookCard = ({
  look,
  sample,
  usedBy,
  onEdit,
  onDuplicate,
}: {
  look: LookSummary;
  sample: SamplePlugin | null;
  /** Outputs showing it */
  usedBy: string[];
  onEdit: () => void;
  onDuplicate: () => void;
}) => {
  const { setLookHidden, deleteLook } = useLooks();
  // Each plugin as it always shows: what every other look falls back to
  const isMain = look.key === MAIN_LOOK_KEY;
  const isOn = isMain || !look.hidden;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <li className="relative">
      <WhyDisabled
        reason={
          isMain
            ? "Each plugin as it always shows, so it's always on and can't be changed. Make a new main view look for another style"
            : null
        }
      >
        <button
          type="button"
          aria-pressed={isOn}
          aria-disabled={isMain || undefined}
          aria-label={look.name}
          title={
            isMain ? undefined : isOn ? "Click to turn off" : "Click to turn on"
          }
          onClick={() => {
            if (!isMain) setLookHidden(look.key, isOn);
          }}
          className={cx(
            "flex w-full flex-col gap-2 rounded-sm border bg-surface-primary p-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isMain ? "cursor-default" : "cursor-pointer",
            isOn
              ? "border-accent"
              : "border-stroke hover:border-stroke-emphasis",
          )}
        >
          <LookPreview
            lookKey={look.key}
            pluginName={sample?.pluginName ?? null}
            className={cx(!isOn && "opacity-40 grayscale")}
          />
          {/* Room on the right for the menu */}
          <span className="flex min-h-8 items-center gap-2 pl-1 pr-9">
            {isOn ? (
              <MdCheckCircle className="size-4 shrink-0 text-accent" />
            ) : (
              <span className="size-4 shrink-0 rounded-full border-2 border-stroke" />
            )}
            <span
              className={cx(
                "min-w-0 flex-1 truncate text-sm font-medium",
                !isOn && "text-secondary",
              )}
            >
              {look.name}
            </span>
          </span>
        </button>
      </WhyDisabled>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute bottom-2 right-2 size-7"
            aria-label={`More for ${look.name}`}
          >
            <MdMoreHoriz className="size-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          hideArrow
          hideCloseButton
          className="w-56 p-1"
        >
          {look.builtIn ? (
            <WhyDisabled reason="Built-in looks can't be changed. Duplicate it to make your own">
              <PopoverMenuItem icon={<VscEdit />} label="Edit" disabled />
            </WhyDisabled>
          ) : (
            <PopoverMenuItem icon={<VscEdit />} label="Edit" onClick={onEdit} />
          )}
          <PopoverMenuItem
            icon={<VscCopy />}
            label="Duplicate"
            onClick={onDuplicate}
          />
          {look.builtIn ? (
            <WhyDisabled
              reason={
                isMain
                  ? "Built-in looks can't be deleted"
                  : "Built-in looks can't be deleted, only turned off"
              }
            >
              <PopoverMenuItem
                icon={<VscTrash />}
                label="Delete"
                className="text-fill-destructive"
                disabled
              />
            </WhyDisabled>
          ) : usedBy.length > 0 ? (
            <PopoverMenuItem
              icon={<VscTrash />}
              label="Delete"
              className="text-fill-destructive"
              disabled
              description={`Pick another look on ${usedBy.join(", ")} first`}
            />
          ) : (
            <PopConfirm
              title="Delete look"
              description={`Delete ${look.name}?`}
              okText="Delete"
              onConfirm={() => {
                setMenuOpen(false);
                deleteLook(look.key);
              }}
            >
              {/* Not a menu item: those close the menu, and this with it */}
              <button type="button" className={DELETE_ITEM_CLASS}>
                <VscTrash className="shrink-0" />
                Delete
              </button>
            </PopConfirm>
          )}
        </PopoverContent>
      </Popover>
    </li>
  );
};

const LookDetail = ({
  look,
  outputs,
  onEditLook,
  onDeleted,
  onDuplicated,
}: {
  look: LookSummary;
  outputs: Outputs;
  onEditLook: (lookKey: string, pluginName: string) => void;
  onDeleted: () => void;
  onDuplicated: (key: string) => void;
}) => {
  const { duplicateLook, renameLook, deleteLook } = useLooks();
  const nameId = useId();
  const usedBy = outputsUsingLook(outputs, look.key);
  const kind = look.type as OutputKind;
  const typeTitle = OUTPUT_KINDS[kind]?.title ?? look.type;

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex max-w-md flex-col gap-1">
        <label htmlFor={nameId} className="text-xs font-medium">
          Name
        </label>
        <Input
          id={nameId}
          value={look.name}
          onChange={(e) => renameLook(look.key, e.target.value)}
          onBlur={(e) =>
            !e.target.value.trim() && renameLook(look.key, typeTitle)
          }
        />
      </div>

      <LookPluginList
        lookKey={look.key}
        lookName={look.name}
        onEditLook={onEditLook}
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-stroke pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDuplicated(duplicateLook(look.key))}
        >
          <VscCopy />
          Duplicate
        </Button>
        <span className="flex-1" />
        {usedBy.length > 0 ? (
          <span className="text-xs text-tertiary">
            Pick another look on {usedBy.join(", ")} to delete it
          </span>
        ) : (
          <PopConfirm
            title="Delete look"
            description={`Delete ${look.name}?`}
            okText="Delete"
            onConfirm={() => {
              deleteLook(look.key);
              onDeleted();
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="text-fill-destructive"
              aria-label={`Delete ${look.name}`}
            >
              <VscTrash />
              Delete
            </Button>
          </PopConfirm>
        )}
      </div>
    </div>
  );
};
