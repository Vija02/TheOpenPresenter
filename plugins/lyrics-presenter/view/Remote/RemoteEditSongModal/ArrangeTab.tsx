import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Tooltip, TooltipContent, TooltipTrigger, cn } from "@repo/ui";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { FaInfoCircle } from "react-icons/fa";
import { VscClose, VscGripper } from "react-icons/vsc";

import { getAvailableSections } from "../../../src/sectionOrder";
import { processSongWithoutArrangement } from "../../../src/songHelpers";

type ArrangeTabProps = {
  content: string;
  sectionOrder: string[] | null;
  onSectionOrderChange: (order: string[] | null) => void;
};

type OrderedItem = {
  id: string;
  section: string;
};

const AVAILABLE_PREFIX = "available-";

export const ArrangeTab = ({
  content,
  sectionOrder,
  onSectionOrderChange,
}: ArrangeTabProps) => {
  // Use React's useId for stable prefix, then add counter for uniqueness
  const idPrefix = useId();
  const idCounterRef = useRef(0);
  const generateId = useCallback(
    () => `${idPrefix}-${++idCounterRef.current}`,
    [idPrefix],
  );

  const availableSections = useMemo(() => {
    return getAvailableSections(processSongWithoutArrangement(content));
  }, [content]);

  // Initialize items with IDs from the initial order
  const [orderedItems, setOrderedItems] = useState<OrderedItem[]>(() => {
    const order = sectionOrder ?? availableSections;
    return order.map((section) => ({ id: generateId(), section }));
  });

  // Sync with external sectionOrder changes (e.g., reset, or parent updates)
  const prevSectionOrderRef = useRef(sectionOrder);
  useEffect(() => {
    const prevOrder = prevSectionOrderRef.current;
    const newOrder = sectionOrder ?? availableSections;

    // Only rebuild if the external order actually changed
    if (JSON.stringify(prevOrder) !== JSON.stringify(sectionOrder)) {
      setOrderedItems(
        newOrder.map((section) => ({ id: generateId(), section })),
      );
    }
    prevSectionOrderRef.current = sectionOrder;
  }, [sectionOrder, availableSections, generateId]);

  const updateOrder = useCallback(
    (newItems: OrderedItem[]) => {
      setOrderedItems(newItems);
      onSectionOrderChange(newItems.map((item) => item.section));
    },
    [onSectionOrderChange],
  );

  const orderedItemIds = useMemo(
    () => orderedItems.map((item) => item.id),
    [orderedItems],
  );

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Check if dragging from available sections
    if (activeIdStr.startsWith(AVAILABLE_PREFIX)) {
      const sectionName = activeIdStr.replace(AVAILABLE_PREFIX, "");

      // Find where to insert
      if (overIdStr === "drop-zone" || overIdStr.startsWith(AVAILABLE_PREFIX)) {
        // Dropped on the drop zone itself or back to available - add to end
        const newItem = { id: generateId(), section: sectionName };
        updateOrder([...orderedItems, newItem]);
      } else {
        // Dropped on an existing item - insert at that position
        const overIndex = orderedItems.findIndex(
          (item) => item.id === overIdStr,
        );
        if (overIndex !== -1) {
          const newItem = { id: generateId(), section: sectionName };
          const newItems = [...orderedItems];
          newItems.splice(overIndex, 0, newItem);
          updateOrder(newItems);
        } else {
          // Fallback: add to end
          const newItem = { id: generateId(), section: sectionName };
          updateOrder([...orderedItems, newItem]);
        }
      }
      return;
    }

    // Reordering within the list
    if (activeIdStr !== overIdStr && !overIdStr.startsWith(AVAILABLE_PREFIX)) {
      const oldIndex = orderedItems.findIndex(
        (item) => item.id === activeIdStr,
      );
      const newIndex = orderedItems.findIndex((item) => item.id === overIdStr);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newItems = arrayMove(orderedItems, oldIndex, newIndex);
        updateOrder(newItems);
      }
    }
  };

  const handleAddSection = (section: string) => {
    const newItem = { id: generateId(), section };
    updateOrder([...orderedItems, newItem]);
  };

  const handleRemoveSection = (index: number) => {
    const newItems = orderedItems.filter((_, i) => i !== index);
    updateOrder(newItems);
  };

  const handleReset = () => {
    const defaultItems = availableSections.map((s) => ({
      id: generateId(),
      section: s,
    }));
    setOrderedItems(defaultItems);
    onSectionOrderChange(null);
  };

  const isCustomOrder = useMemo(() => {
    if (orderedItems.length !== availableSections.length) return true;
    return orderedItems.some(
      (item, index) => item.section !== availableSections[index],
    );
  }, [orderedItems, availableSections]);

  return (
    <div className="flex-1 flex flex-col gap-4">
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragEnd={handleDragEnd}
      >
        <div>
          <div className="flex items-center justify-between gap-2 pb-2">
            <div className="flex items-center gap-2">
              <h4 className="font-medium pb-1">Arrangement</h4>
              <Tooltip>
                <TooltipTrigger>
                  <FaInfoCircle className="text-gray-400 hover:text-gray-600 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Sections can appear multiple times. For example, add
                    "Chorus" after each verse to repeat it.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            {isCustomOrder && (
              <Button size="xs" onClick={handleReset}>
                Reset to Default
              </Button>
            )}
          </div>

          <p className="text-xs text-secondary mb-2">
            Drag or click to add to the arrangement
          </p>
          <div
            className="flex flex-wrap gap-2 mb-4"
            data-testid="ly-available-sections"
          >
            {availableSections.map((section) => (
              <DraggableAvailableSection
                key={section}
                id={`${AVAILABLE_PREFIX}${section}`}
                section={section}
                onClick={() => handleAddSection(section)}
              />
            ))}
          </div>

          <SortableContext
            items={orderedItemIds}
            strategy={verticalListSortingStrategy}
          >
            <DroppableArea
              orderedItems={orderedItems}
              onRemoveSection={handleRemoveSection}
            />
          </SortableContext>
        </div>
      </DndContext>
    </div>
  );
};

type DroppableAreaProps = {
  orderedItems: OrderedItem[];
  onRemoveSection: (index: number) => void;
};

const DroppableArea = ({
  orderedItems,
  onRemoveSection,
}: DroppableAreaProps) => {
  const { setNodeRef } = useDroppable({
    id: "drop-zone",
  });

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col gap-1 min-h-[60px] p-2 border border-stroke rounded bg-surface-secondary transition-colors"
      data-testid="ly-arrangement-dropzone"
    >
      {orderedItems.length === 0 ? (
        <p className="text-sm text-tertiary py-2 text-center">
          No sections. Drag or click above to add.
        </p>
      ) : (
        orderedItems.map((item, index) => (
          <SortableChip
            key={item.id}
            id={item.id}
            section={item.section}
            onRemove={() => onRemoveSection(index)}
          />
        ))
      )}
    </div>
  );
};

type DraggableAvailableSectionProps = {
  id: string;
  section: string;
  onClick: () => void;
};

const DraggableAvailableSection = ({
  id,
  section,
  onClick,
}: DraggableAvailableSectionProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id,
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 1000,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1 px-3 py-1.5 rounded border border-stroke bg-surface-primary select-none cursor-grab hover:border-primary hover:bg-surface-primary-hover transition-colors",
        isDragging && "shadow-lg border-primary z-50",
      )}
      data-testid={`ly-available-section-${section}`}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          onClick();
        }
      }}
    >
      <span className="text-primary text-sm">+</span>
      <span className="text-sm">{section}</span>
    </div>
  );
};

type SortableChipProps = {
  id: string;
  section: string;
  onRemove: () => void;
};

const SortableChip = ({ id, section, onRemove }: SortableChipProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded bg-surface-primary border border-stroke select-none",
        isDragging && "opacity-50 shadow-lg z-50",
        !isDragging && "cursor-grab",
      )}
      data-testid="ly-arrangement-item"
      {...attributes}
      {...listeners}
    >
      <VscGripper className="text-secondary flex-shrink-0" />
      <span className="text-sm flex-1">{section}</span>
      <Button
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        size="xs"
        data-testid="ly-arrangement-item-remove"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <VscClose />
      </Button>
    </div>
  );
};
