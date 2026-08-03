import {
  LayoutAspectRatio,
  LayoutItem,
  SceneLayoutPosition,
} from "@repo/base-plugin";
import { Rect } from "@repo/layout";
import { EditorItem, LayoutEditor, RectChange } from "@repo/layout/editor";
import { useData } from "@repo/shared";
import { cx } from "class-variance-authority";
import { useCallback, useMemo, useState } from "react";

export type ItemPositionChange = {
  itemId: string;
  position: SceneLayoutPosition;
};

export type InteractiveLayoutEditorProps = {
  aspectRatio: LayoutAspectRatio;
  items: LayoutItem[];
  onItemPositionsChange: (changes: ItemPositionChange[]) => void;
};

type PreviewItem = EditorItem & {
  source: LayoutItem;
  label: string;
  colorIndex: number;
};

const colors = [
  { bg: "bg-red-200", border: "border-red-400" },
  { bg: "bg-blue-200", border: "border-blue-400" },
  { bg: "bg-green-200", border: "border-green-400" },
  { bg: "bg-yellow-200", border: "border-yellow-400" },
  { bg: "bg-purple-200", border: "border-purple-400" },
  { bg: "bg-pink-200", border: "border-pink-400" },
  { bg: "bg-orange-200", border: "border-orange-400" },
  { bg: "bg-teal-200", border: "border-teal-400" },
];

const toRect = (position: SceneLayoutPosition): Rect => ({
  x: position.x,
  y: position.y,
  w: position.width,
  h: position.height,
});

const toPosition = (rect: Rect): SceneLayoutPosition => ({
  x: rect.x,
  y: rect.y,
  width: rect.w,
  height: rect.h,
});

const InteractiveLayoutEditor = ({
  aspectRatio,
  items,
  onItemPositionsChange,
}: InteractiveLayoutEditorProps) => {
  const data = useData();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const stageAspectRatio = useMemo(
    () => ({
      width: aspectRatio?.width ?? 16,
      height: aspectRatio?.height ?? 9,
    }),
    [aspectRatio?.width, aspectRatio?.height],
  );

  const previewItems = useMemo(() => {
    const result: PreviewItem[] = [];

    items.forEach((item, index) => {
      const isScreenItem = item.type === "screenItem";
      const scene = !isScreenItem ? data.data[item.sceneId!] : null;
      if (!isScreenItem && (!scene || scene.type !== "scene")) return;

      result.push({
        id: item.id,
        rect: toRect(item.position),
        source: item,
        colorIndex: index % colors.length,
        label: isScreenItem
          ? `Screen ${item.sourceRendererId}`
          : item.label ||
            (scene?.type === "scene" ? scene.name : "") ||
            "Unknown",
      });
    });

    return result;
  }, [items, data.data]);

  const handleChange = useCallback(
    (changes: RectChange[]) => {
      onItemPositionsChange(
        changes.map(({ id, rect }) => ({
          itemId: id,
          position: toPosition(rect),
        })),
      );
    },
    [onItemPositionsChange],
  );

  const renderItem = useCallback(
    (item: PreviewItem, { selected }: { selected: boolean }) => {
      const color = colors[item.colorIndex]!;
      const isScreenItem = item.source.type === "screenItem";
      const derivation = item.source.derivation;

      return (
        <div
          className={cx(
            "w-full h-full rounded flex flex-col items-center justify-center",
            "text-xs font-medium overflow-hidden border-2",
            isScreenItem ? "bg-purple-200 border-purple-400" : color.bg,
            !isScreenItem && color.border,
            derivation !== null && "border-dashed",
            selected && "ring-2 ring-blue-500",
          )}
        >
          <span className="truncate px-1">{item.label}</span>
          {derivation !== null && (
            <span className="text-[10px] text-gray-600">
              {derivation.offset > 0 ? "+" : ""}
              {derivation.offset}
            </span>
          )}
        </div>
      );
    },
    [],
  );

  return (
    <div className="w-full max-w-full overflow-hidden">
      <LayoutEditor
        items={previewItems}
        aspectRatio={stageAspectRatio}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onChange={handleChange}
        renderItem={renderItem}
        background="#f3f4f6"
      />
    </div>
  );
};

export default InteractiveLayoutEditor;
