import {
  LayoutAspectRatio,
  LayoutItem,
  SceneLayoutPosition,
} from "@repo/base-plugin";
import { useData } from "@repo/shared";
import { cx } from "class-variance-authority";
import { useCallback, useRef, useState } from "react";

export type InteractiveLayoutEditorProps = {
  aspectRatio: LayoutAspectRatio;
  items: LayoutItem[];
  onItemPositionChange: (itemId: string, position: SceneLayoutPosition) => void;
};

const InteractiveLayoutEditor = ({
  aspectRatio,
  items,
  onItemPositionChange,
}: InteractiveLayoutEditorProps) => {
  const data = useData();

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{
    type: "move" | "resize";
    id: string;
    startX: number;
    startY: number;
    startPosition: SceneLayoutPosition;
    resizeHandle?: "se" | "sw" | "ne" | "nw";
  } | null>(null);

  const aspectWidth = aspectRatio?.width ?? 16;
  const aspectHeight = aspectRatio?.height ?? 9;

  const colors = [
    { bg: "bg-red-200", border: "border-red-400", selected: "ring-red-500" },
    { bg: "bg-blue-200", border: "border-blue-400", selected: "ring-blue-500" },
    {
      bg: "bg-green-200",
      border: "border-green-400",
      selected: "ring-green-500",
    },
    {
      bg: "bg-yellow-200",
      border: "border-yellow-400",
      selected: "ring-yellow-500",
    },
    {
      bg: "bg-purple-200",
      border: "border-purple-400",
      selected: "ring-purple-500",
    },
    { bg: "bg-pink-200", border: "border-pink-400", selected: "ring-pink-500" },
    {
      bg: "bg-orange-200",
      border: "border-orange-400",
      selected: "ring-orange-500",
    },
    { bg: "bg-teal-200", border: "border-teal-400", selected: "ring-teal-500" },
  ];

  const handleMouseDown = useCallback(
    (
      e: React.MouseEvent,
      id: string,
      type: "move" | "resize",
      resizeHandle?: "se" | "sw" | "ne" | "nw",
    ) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedId(id);

      const item = items.find((i) => i.id === id);
      const position = item?.position || {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      };

      setDragState({
        type,
        id,
        startX: e.clientX,
        startY: e.clientY,
        startPosition: { ...position },
        resizeHandle,
      });
    },
    [items],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const deltaXPercent = ((e.clientX - dragState.startX) / rect.width) * 100;
      const deltaYPercent =
        ((e.clientY - dragState.startY) / rect.height) * 100;

      const { startPosition, type, resizeHandle, id } = dragState;

      let newPosition: SceneLayoutPosition;

      if (type === "move") {
        newPosition = {
          ...startPosition,
          x: Math.max(
            0,
            Math.min(
              100 - startPosition.width,
              startPosition.x + deltaXPercent,
            ),
          ),
          y: Math.max(
            0,
            Math.min(
              100 - startPosition.height,
              startPosition.y + deltaYPercent,
            ),
          ),
        };
      } else {
        // Resize
        newPosition = { ...startPosition };
        const minSize = 5; // Minimum 5%

        switch (resizeHandle) {
          case "se": // Bottom-right
            newPosition.width = Math.max(
              minSize,
              Math.min(
                100 - startPosition.x,
                startPosition.width + deltaXPercent,
              ),
            );
            newPosition.height = Math.max(
              minSize,
              Math.min(
                100 - startPosition.y,
                startPosition.height + deltaYPercent,
              ),
            );
            break;
          case "sw": // Bottom-left
            {
              const newX = startPosition.x + deltaXPercent;
              const newWidth = startPosition.width - deltaXPercent;
              if (newX >= 0 && newWidth >= minSize) {
                newPosition.x = newX;
                newPosition.width = newWidth;
              }
              newPosition.height = Math.max(
                minSize,
                Math.min(
                  100 - startPosition.y,
                  startPosition.height + deltaYPercent,
                ),
              );
            }
            break;
          case "ne": // Top-right
            {
              const newY = startPosition.y + deltaYPercent;
              const newHeight = startPosition.height - deltaYPercent;
              if (newY >= 0 && newHeight >= minSize) {
                newPosition.y = newY;
                newPosition.height = newHeight;
              }
              newPosition.width = Math.max(
                minSize,
                Math.min(
                  100 - startPosition.x,
                  startPosition.width + deltaXPercent,
                ),
              );
            }
            break;
          case "nw": // Top-left
            {
              const newX = startPosition.x + deltaXPercent;
              const newWidth = startPosition.width - deltaXPercent;
              const newY = startPosition.y + deltaYPercent;
              const newHeight = startPosition.height - deltaYPercent;
              if (newX >= 0 && newWidth >= minSize) {
                newPosition.x = newX;
                newPosition.width = newWidth;
              }
              if (newY >= 0 && newHeight >= minSize) {
                newPosition.y = newY;
                newPosition.height = newHeight;
              }
            }
            break;
        }
      }

      // Round to 1 decimal place for cleaner values
      newPosition.x = Math.round(newPosition.x * 10) / 10;
      newPosition.y = Math.round(newPosition.y * 10) / 10;
      newPosition.width = Math.round(newPosition.width * 10) / 10;
      newPosition.height = Math.round(newPosition.height * 10) / 10;

      onItemPositionChange(id, newPosition);
    },
    [dragState, onItemPositionChange],
  );

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  const handleContainerClick = useCallback(() => {
    setSelectedId(null);
  }, []);

  return (
    <div ref={wrapperRef} className="w-full max-w-full overflow-hidden">
      <div
        ref={containerRef}
        className="relative border-2 border-dashed border-gray-300 bg-gray-100 rounded overflow-hidden select-none max-w-full"
        style={{
          width: "100%",
          aspectRatio: aspectWidth / aspectHeight,
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleContainerClick}
      >
        {items.map((item, index) => {
          const isScreenItem = item.type === "screenItem";
          const scene = !isScreenItem ? data.data[item.sceneId!] : null;

          if (!isScreenItem && (!scene || scene.type !== "scene")) return null;

          const color = colors[index % colors.length]!;
          const isSelected = selectedId === item.id;
          const position = item.position;

          // Display label
          const displayLabel = isScreenItem
            ? `Screen ${item.sourceRendererId}`
            : item.label || scene?.name || "Unknown";

          return (
            <div
              key={item.id}
              className={cx(
                "absolute rounded flex flex-col items-center justify-center text-xs font-medium overflow-visible border-2",
                isScreenItem ? "bg-purple-200 border-purple-400" : color.bg,
                isScreenItem ? "border-purple-400" : color.border,
                isSelected &&
                  `ring-2 ${isScreenItem ? "ring-purple-500" : color.selected}`,
                dragState?.id === item.id ? "cursor-grabbing" : "cursor-grab",
              )}
              style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
                width: `${position.width}%`,
                height: `${position.height}%`,
                zIndex: isSelected ? 10 : 1,
              }}
              onMouseDown={(e) => handleMouseDown(e, item.id, "move")}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="truncate px-1 pointer-events-none">
                {displayLabel}
              </span>

              {/* Resize handles - only show when selected */}
              {isSelected && (
                <>
                  <div
                    className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-gray-600 rounded-sm cursor-se-resize"
                    onMouseDown={(e) =>
                      handleMouseDown(e, item.id, "resize", "se")
                    }
                  />
                  <div
                    className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-gray-600 rounded-sm cursor-sw-resize"
                    onMouseDown={(e) =>
                      handleMouseDown(e, item.id, "resize", "sw")
                    }
                  />
                  <div
                    className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-gray-600 rounded-sm cursor-ne-resize"
                    onMouseDown={(e) =>
                      handleMouseDown(e, item.id, "resize", "ne")
                    }
                  />
                  <div
                    className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-gray-600 rounded-sm cursor-nw-resize"
                    onMouseDown={(e) =>
                      handleMouseDown(e, item.id, "resize", "nw")
                    }
                  />
                </>
              )}
            </div>
          );
        })}

        {/* Position info tooltip when dragging */}
        {dragState && (
          <div className="absolute bottom-2 left-2 bg-black/75 text-white text-xs px-2 py-1 rounded">
            {(() => {
              const pos = items.find((i) => i.id === dragState.id)?.position;
              if (!pos) return null;
              return `X: ${pos.x.toFixed(1)}% Y: ${pos.y.toFixed(1)}% W: ${pos.width.toFixed(1)}% H: ${pos.height.toFixed(1)}%`;
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default InteractiveLayoutEditor;
