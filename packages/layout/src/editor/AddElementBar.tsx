import { ReactNode } from "react";
import {
  LuCircle,
  LuImage,
  LuMinus,
  LuSquare,
  LuType,
  LuVideo,
} from "react-icons/lu";

import { LayoutDoc } from "../schema/document";
import {
  AddResult,
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

export const AddElementBar = ({
  doc,
  onChange,
  onSelectionChange,
  pluginApi,
  labels,
  className,
}: AddElementBarProps) => {
  const compact = useIsCompact();
  // On a phone the canvas is capped at 55% of the viewport
  const showLabels = labels ?? !compact;

  const items: Item[] = [
    {
      key: "text",
      label: "Text",
      icon: <LuType size={ICON_SIZE} />,
      run: addTextElement,
    },
    {
      key: "rect",
      label: "Rectangle",
      icon: <LuSquare size={ICON_SIZE} />,
      run: (d) => addShape(d, "rect"),
    },
    {
      key: "ellipse",
      label: "Ellipse",
      icon: <LuCircle size={ICON_SIZE} />,
      run: (d) => addShape(d, "ellipse"),
    },
    {
      key: "line",
      label: "Line",
      icon: <LuMinus size={ICON_SIZE} />,
      run: (d) => addShape(d, "line"),
    },
    ...(pluginApi
      ? [
          {
            key: "image",
            label: "Picture",
            icon: <LuImage size={ICON_SIZE} />,
            run: (d: LayoutDoc) => addImageElement(d, pluginApi),
          },
          {
            key: "video",
            label: "Video",
            icon: <LuVideo size={ICON_SIZE} />,
            run: (d: LayoutDoc) => addVideoElement(d, pluginApi),
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
          className={`flex cursor-pointer flex-col items-center gap-0.5 rounded text-2xs text-secondary transition-colors hover:bg-surface-secondary hover:text-primary ${
            showLabels ? "px-2 py-1" : "p-2"
          }`}
        >
          {item.icon}
          {showLabels && <span className="leading-none">{item.label}</span>}
        </button>
      ))}
    </div>
  );
};
