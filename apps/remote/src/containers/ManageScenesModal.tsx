import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
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
import { useData, usePluginData } from "@repo/shared";
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
  cn,
  useOverlayToggle,
} from "@repo/ui";
import { sortBy } from "lodash-es";
import { useMemo } from "react";
import { VscAdd, VscGripper, VscTrash } from "react-icons/vsc";

import { useNavigateWithParams } from "../hooks/useNavigateWithParams";
import { deleteScene } from "../util/sceneActions";

const ManageScenesModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();
  const navigate = useNavigateWithParams();

  const data = useData();
  const mainState = usePluginData().mainState!;

  const scenes = useMemo(
    () =>
      sortBy(
        Object.entries(data.data).filter(([, value]) => value.type === "scene"),
        ([, value]) => value.order,
      ).map(([id, value]) => ({ id, name: value.name, order: value.order })),
    [data.data],
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = scenes.map((x) => x.id);
    const reordered = arrayMove(
      ids,
      ids.indexOf(active.id as string),
      ids.indexOf(over.id as string),
    );
    const nextScene = reordered[Symbol.iterator]();
    sortBy(Object.entries(mainState.data), ([, value]) => value.order).forEach(
      ([id, value], index) => {
        const targetId = value.type === "scene" ? nextScene.next().value! : id;
        mainState.data[targetId]!.order = index + 1;
      },
    );
  };

  return (
    <Dialog
      open={isOpen ?? false}
      onOpenChange={(open, details) => {
        const target = details.event?.target;
        if (
          !open &&
          details.reason === "escape-key" &&
          target instanceof Element &&
          target.closest("[data-scene-name-input]")
        ) {
          details.cancel();
          return;
        }
        onToggle?.();
      }}
    >
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Manage scenes</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {scenes.length === 0 ? (
            <p className="py-4 text-sm text-secondary">No scenes yet.</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={scenes.map((x) => x.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="stack-col items-stretch gap-1 py-2">
                  {scenes.map((scene) => (
                    <SceneRow
                      key={scene.id}
                      id={scene.id}
                      name={scene.name}
                      onRename={(name) => {
                        mainState.data[scene.id]!.name = name;
                      }}
                      onDelete={() => deleteScene(mainState, scene.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            className="mr-auto"
            onClick={() => {
              onToggle?.();
              navigate("/new");
            }}
          >
            <VscAdd />
            Add scene
          </Button>
          <Button variant="outline" onClick={onToggle}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageScenesModal;

const SceneRow = ({
  id,
  name,
  onRename,
  onDelete,
}: {
  id: string;
  name: string;
  onRename: (name: string) => void;
  onDelete: () => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const commit = (value: string) => {
    const next = value.trim();
    if (next !== "" && next !== name) onRename(next);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-testid="manage-scenes-row"
      className={cn(
        "stack-row gap-1 rounded-sm border border-transparent bg-white p-1",
        // Opaque so a dragged row covers the ones it passes
        isDragging && "relative z-10 border-fill-default shadow-md",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="shrink-0 cursor-grab touch-none px-1 py-2 text-secondary active:cursor-grabbing"
        aria-label={`Reorder ${name}`}
        {...attributes}
        {...listeners}
      >
        <VscGripper />
      </button>
      <Input
        // Remounts when the name changes elsewhere, so it never shows stale text
        key={name}
        defaultValue={name}
        aria-label="Scene name"
        data-scene-name-input
        className="h-8 flex-1 min-w-0"
        onBlur={(e) => {
          commit(e.currentTarget.value);
          // An empty name isn't saved, so show the real one again
          if (e.currentTarget.value.trim() === "") {
            e.currentTarget.value = name;
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = name;
            e.currentTarget.blur();
          }
        }}
      />
      <PopConfirm
        title={`Delete "${name}"?`}
        description="This can't be undone."
        okText="Delete"
        okButtonProps={{ variant: "destructive" }}
        onConfirm={onDelete}
      >
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Delete ${name}`}
          className="shrink-0 text-gray-500 hover:text-red-600"
        >
          <VscTrash />
        </Button>
      </PopConfirm>
    </div>
  );
};
