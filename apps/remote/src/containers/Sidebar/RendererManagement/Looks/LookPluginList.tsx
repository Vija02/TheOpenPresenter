import {
  PluginLookChoice,
  pluginLookChoice,
  pluginStyles,
  rootLookKey,
} from "@repo/layout";
import { useData } from "@repo/shared";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@repo/ui";
import { cx } from "class-variance-authority";
import { useMemo, useState } from "react";
import { MdExpandMore } from "react-icons/md";
import { VscEdit } from "react-icons/vsc";

import { useRegisteredPluginMeta } from "../Layout/useRegisteredPluginMeta";
import LookPreview from "./LookPreview";
import { useLooks } from "./useLooks";

type LookPluginListProps = {
  lookKey: string;
  lookName: string;
  onEditLook: (lookKey: string, pluginName: string) => void;
};

const choiceName = (choice: PluginLookChoice) =>
  choice.kind === "own"
    ? "Customized"
    : choice.kind === "style"
      ? choice.style.name
      : "As on main";

const LookPluginList = ({
  lookKey,
  lookName,
  onEditLook,
}: LookPluginListProps) => {
  const data = useData();
  const { titleByPlugin, samplePlugins } = useRegisteredPluginMeta();

  const names = useMemo(() => {
    const ordered: string[] = [];
    for (const pluginName of [
      ...samplePlugins,
      ...Object.keys(data.looks?.[lookKey]?.plugins ?? {}),
    ]) {
      if (titleByPlugin.has(pluginName) && !ordered.includes(pluginName)) {
        ordered.push(pluginName);
      }
    }
    return ordered;
  }, [samplePlugins, data.looks, lookKey, titleByPlugin]);

  return (
    <section className="flex flex-col gap-2" aria-label="How each plugin shows">
      <h4 className="text-sm font-medium">How each plugin shows</h4>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {names.map((pluginName) => (
          <PluginTile
            key={pluginName}
            lookKey={lookKey}
            lookName={lookName}
            pluginName={pluginName}
            title={titleByPlugin.get(pluginName) ?? pluginName}
            hasSample={samplePlugins.includes(pluginName)}
            onEditLook={onEditLook}
          />
        ))}
      </ul>
    </section>
  );
};

export default LookPluginList;

const PluginTile = ({
  lookKey,
  lookName,
  pluginName,
  title,
  hasSample,
  onEditLook,
}: {
  lookKey: string;
  lookName: string;
  pluginName: string;
  title: string;
  hasSample: boolean;
  onEditLook: (lookKey: string, pluginName: string) => void;
}) => {
  const data = useData();
  const { looks: registered } = useRegisteredPluginMeta();
  const { setPluginStyle } = useLooks();
  const [open, setOpen] = useState(false);

  const choice = pluginLookChoice(registered, data.looks, pluginName, lookKey);
  const styles = pluginStyles(
    registered,
    pluginName,
    rootLookKey(data.looks, lookKey),
  );
  const isOwn = choice.kind === "own";
  const canChoose = styles.length > 1 || (isOwn && styles.length > 0);

  return (
    <li className="flex flex-col gap-2 rounded-sm border border-stroke bg-surface-primary p-1.5">
      {hasSample ? (
        <LookPreview lookKey={lookKey} pluginName={pluginName} />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center border border-stroke bg-surface-secondary text-xs text-tertiary">
          No preview
        </div>
      )}
      <div className="flex items-center gap-1 pl-1">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          {canChoose ? (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`Style of ${title} on ${lookName}: ${choiceName(choice)}`}
                  className={cx(
                    "-ml-1 flex max-w-full items-center gap-0.5 rounded-sm px-1 text-xs transition-colors cursor-pointer hover:bg-surface-primary-hover",
                    isOwn ? "font-medium text-fill-info" : "text-secondary",
                  )}
                >
                  <span className="truncate">{choiceName(choice)}</span>
                  <MdExpandMore
                    className={cx(
                      "shrink-0 transition-transform",
                      open && "rotate-180",
                    )}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                hideArrow
                hideCloseButton
                className="w-[min(92vw,560px)] max-w-none p-2"
              >
                <div
                  role="radiogroup"
                  aria-label={`Style of ${title}`}
                  className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                >
                  {styles.map((style) => {
                    const checked =
                      choice.kind === "style" &&
                      choice.style.style === style.style;
                    return (
                      <button
                        key={style.style}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        aria-label={style.name}
                        onClick={() => {
                          setOpen(false);
                          if (checked) return;
                          if (
                            isOwn &&
                            !window.confirm(
                              `Your changes to ${title} on ${lookName} will be lost. Continue?`,
                            )
                          ) {
                            return;
                          }
                          setPluginStyle(lookKey, pluginName, style.style);
                        }}
                        className={cx(
                          "flex flex-col gap-1.5 rounded-sm border p-1 text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          checked
                            ? "border-accent"
                            : "border-stroke hover:border-stroke-emphasis",
                        )}
                      >
                        {hasSample && (
                          <LookPreview
                            lookKey={lookKey}
                            pluginName={pluginName}
                            style={style.style}
                          />
                        )}
                        <span className="truncate px-0.5 text-xs font-medium">
                          {style.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <span className="block truncate text-xs text-tertiary">
              {choiceName(choice)}
            </span>
          )}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          aria-label={`${isOwn ? "Edit" : "Customize"} ${title} on ${lookName}`}
          title={isOwn ? "Edit" : "Customize"}
          onClick={() => onEditLook(lookKey, pluginName)}
        >
          <VscEdit />
        </Button>
      </div>
    </li>
  );
};
