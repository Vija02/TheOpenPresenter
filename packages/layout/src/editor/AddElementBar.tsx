import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button as UiButton,
} from "@repo/ui";
import { ReactNode, useState } from "react";
import {
  LuCircle,
  LuImage,
  LuMinus,
  LuMonitor,
  LuSquare,
  LuType,
  LuVideo,
} from "react-icons/lu";

import { HostSourceOption, useHostCatalog } from "../react/context/hostCatalog";
import { LayoutDoc } from "../schema/document";
import { useLayoutInsertDefaults } from "./InsertDefaultsContext";
import {
  AddResult,
  addHostElement,
  addImageElement,
  addShape,
  addTextElement,
  addVideoElement,
} from "./addElement";
import { LayoutPluginApi } from "./pluginApi";
import { useIsCompact } from "./useMediaQuery";

export type AddElementBarProps = {
  doc: LayoutDoc;
  onChange: (doc: LayoutDoc) => void;
  onSelectionChange: (ids: string[]) => void;
  pluginApi?: LayoutPluginApi;
  labels?: boolean;
  className?: string;
};

type Item = {
  key: string;
  label: string;
  icon: ReactNode;
  run: (doc: LayoutDoc) => AddResult | null | Promise<AddResult | null>;
};

const ICON_SIZE = 16;

const buttonClass = (showLabels: boolean) =>
  `flex cursor-pointer flex-col items-center gap-0.5 rounded text-2xs text-secondary transition-colors hover:bg-surface-secondary hover:text-primary ${
    showLabels ? "px-2 py-1" : "p-2"
  }`;

export const AddElementBar = ({
  doc,
  onChange,
  onSelectionChange,
  pluginApi,
  labels,
  className,
}: AddElementBarProps) => {
  const compact = useIsCompact();
  const defaults = useLayoutInsertDefaults();
  const { sources } = useHostCatalog();
  // On a phone the canvas is capped at 55% of the viewport
  const showLabels = labels ?? !compact;

  const items: Item[] = [
    {
      key: "text",
      label: "Text",
      icon: <LuType size={ICON_SIZE} />,
      run: (d: LayoutDoc) => addTextElement(d, defaults),
    },
    {
      key: "rect",
      label: "Rectangle",
      icon: <LuSquare size={ICON_SIZE} />,
      run: (d: LayoutDoc) => addShape(d, "rect", defaults),
    },
    {
      key: "ellipse",
      label: "Ellipse",
      icon: <LuCircle size={ICON_SIZE} />,
      run: (d: LayoutDoc) => addShape(d, "ellipse", defaults),
    },
    {
      key: "line",
      label: "Line",
      icon: <LuMinus size={ICON_SIZE} />,
      run: (d: LayoutDoc) => addShape(d, "line", defaults),
    },
    ...(pluginApi
      ? [
          {
            key: "image",
            label: "Picture",
            icon: <LuImage size={ICON_SIZE} />,
            run: (d: LayoutDoc) => addImageElement(d, pluginApi, defaults),
          },
          {
            key: "video",
            label: "Video",
            icon: <LuVideo size={ICON_SIZE} />,
            run: (d: LayoutDoc) => addVideoElement(d, pluginApi, defaults),
          },
        ]
      : []),
  ];

  const handle = async (item: Item) => {
    const result = await item.run(doc);
    if (!result) return;
    onChange(result.doc);
    onSelectionChange([result.id]);
  };

  const handleAddHost = (option: HostSourceOption) => {
    const result = addHostElement(doc, option.source, {
      name: option.label,
      defaults,
    });
    onChange(result.doc);
    onSelectionChange([result.id]);
  };

  return (
    <div
      role="toolbar"
      aria-label="Add element"
      onPointerDown={(e) => e.stopPropagation()}
      className={`lay--add-bar flex items-center gap-0.5 rounded-lg border border-stroke bg-surface-primary p-1 shadow-md ${
        className ?? ""
      }`}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          title={`Add ${item.label.toLowerCase()}`}
          aria-label={`Add ${item.label.toLowerCase()}`}
          onClick={() => void handle(item)}
          className={buttonClass(showLabels)}
        >
          {item.icon}
          {showLabels && <span className="leading-none">{item.label}</span>}
        </button>
      ))}

      {sources.length > 0 && (
        <AddHostButton
          sources={sources}
          showLabels={showLabels}
          onSelect={handleAddHost}
        />
      )}
    </div>
  );
};

// Opens a dropdown
const AddHostButton = ({
  sources,
  showLabels,
  onSelect,
}: {
  sources: HostSourceOption[];
  showLabels: boolean;
  onSelect: (option: HostSourceOption) => void;
}) => {
  const [open, setOpen] = useState(false);

  const groups = sources.reduce<Map<string, HostSourceOption[]>>(
    (acc, option) => {
      const key = option.group ?? "";
      const existing = acc.get(key);
      if (existing) existing.push(option);
      else acc.set(key, [option]);
      return acc;
    },
    new Map(),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Add live content"
          aria-label="Add live content"
          className={buttonClass(showLabels)}
        >
          <LuMonitor size={ICON_SIZE} />
          {showLabels && <span className="leading-none">Live</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        hideCloseButton
        className="w-[240px] max-h-[320px] overflow-y-auto p-1"
      >
        {[...groups.entries()].map(([group, options]) => (
          <div key={group} className="flex flex-col">
            {group && (
              <span className="px-2 pt-2 pb-1 text-2xs uppercase tracking-wide text-secondary">
                {group}
              </span>
            )}
            {options.map((option) => (
              <UiButton
                key={option.id}
                size="sm"
                variant="ghost"
                className="justify-start"
                onClick={() => {
                  onSelect(option);
                  setOpen(false);
                }}
              >
                {option.label}
              </UiButton>
            ))}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
};
