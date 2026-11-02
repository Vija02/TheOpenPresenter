import { Button, Popover, PopoverContent, PopoverTrigger } from "@repo/ui";
import { cx } from "class-variance-authority";
import { useState } from "react";
import { MdExpandMore } from "react-icons/md";

import { OUTPUT_KINDS, SIMPLE_KINDS } from "../outputKinds";
import LookPreview from "./LookPreview";
import { useLooks } from "./useLooks";
import { useSamplePlugins } from "./useSamplePlugins";

type LookPickerProps = {
  value: string;
  onChange: (lookKey: string) => void;
  onManage: () => void;
};

const LookPicker = ({ value, onChange, onManage }: LookPickerProps) => {
  const { looks } = useLooks();
  const sample = useSamplePlugins()[0] ?? null;
  const [open, setOpen] = useState(false);

  const current = looks.find((look) => look.key === value);
  const currentKind =
    OUTPUT_KINDS[
      SIMPLE_KINDS.find((entry) => entry.lookKey === current?.type)?.kind ??
        "main"
    ];
  const CurrentIcon = currentKind.icon;
  // Turned off, but still shown here while this output uses it
  const offered = looks.filter((look) => !look.hidden || look.key === value);
  const groups = SIMPLE_KINDS.map((entry) => ({
    ...entry,
    looks: offered.filter((look) => look.type === entry.lookKey),
  })).filter((group) => group.looks.length > 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Look: ${current?.name ?? value}`}
          className="flex w-full items-center gap-3 rounded-sm border border-stroke bg-surface-primary p-1.5 pr-3 text-left transition-colors cursor-pointer hover:bg-surface-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-9 w-16 shrink-0 items-center justify-center rounded-sm bg-surface-secondary text-secondary">
            <CurrentIcon className="size-5" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {current?.name ?? value}
          </span>
          <MdExpandMore
            className={cx(
              "size-5 shrink-0 text-secondary transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        hideArrow
        hideCloseButton
        className="flex max-h-[min(70vh,var(--radix-popover-content-available-height))] w-[min(94vw,720px)] max-w-none flex-col p-3"
      >
        <div
          role="radiogroup"
          aria-label="Look"
          className="-mx-3 grid min-h-0 flex-1 gap-4 overflow-y-auto px-3 sm:grid-cols-3"
        >
          {groups.map((group) => {
            const Icon = OUTPUT_KINDS[group.kind].icon;
            return (
              <div key={group.lookKey} className="flex flex-col gap-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-secondary">
                  <Icon className="size-4" />
                  {group.plural}
                </span>
                {group.looks.map((look) => {
                  const checked = look.key === value;
                  return (
                    <button
                      key={look.key}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      aria-label={look.name}
                      onClick={() => {
                        setOpen(false);
                        if (!checked) onChange(look.key);
                      }}
                      className={cx(
                        "flex flex-col gap-1.5 rounded-sm border p-1.5 text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        checked
                          ? "border-accent bg-surface-primary-active"
                          : "border-stroke hover:bg-surface-primary-hover",
                      )}
                    >
                      <LookPreview
                        lookKey={look.key}
                        pluginName={sample?.pluginName ?? null}
                      />
                      <span className="truncate px-0.5 text-xs font-medium">
                        {look.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex shrink-0 items-center justify-between gap-2 border-t border-stroke pt-2">
          <span className="text-xs text-tertiary">
            Want another style? Make your own look.
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false);
              onManage();
            }}
          >
            Manage looks…
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default LookPicker;
