import type { MediaPickerResult } from "@repo/base-types";
import {
  DragEvent,
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useState,
} from "react";

import { LayoutDoc } from "../../schema/document";
import { FillPaint } from "../../schema/paint";
import { addMediaElement } from "../addElement";
import {
  LayoutInsertDefaults,
  NO_INSERT_DEFAULTS,
  applyFillDefaults,
} from "../insertDefaults";
import { LayoutPluginApi } from "../pluginApi";
import { MediaStrip } from "./MediaStrip";
import {
  MEDIA_DRAG_TYPE,
  StagePoint,
  mediaClickTarget,
  mediaDropTarget,
  setElementFill,
} from "./mediaDrop";
import { mediaToFill } from "./mediaItem";
import { useMediaStripState } from "./useMediaStripState";

/** Drop target meaning the whole stage, when `action` takes the drop */
const STAGE_DROP = "\u0000stage";

export type MediaStripOptions = {
  doc: LayoutDoc;
  onChange: (doc: LayoutDoc) => void;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  insertDefaults?: LayoutInsertDefaults;
  pluginApi?: LayoutPluginApi;
  /** The workbench root: holds the canvas, and sizes the panel */
  rootRef: RefObject<HTMLDivElement | null>;
  compact: boolean;
  startOpen: boolean;
  /** See `LayoutWorkbenchProps.mediaAction` */
  action?: (picked: MediaPickerResult | null) => void;
  colourAction?: (fill: FillPaint) => void;
  selection?: FillPaint | null;
  headerExtras?: ReactNode;
};

export const useMediaStrip = ({
  doc,
  onChange,
  selectedIds,
  setSelectedIds,
  insertDefaults,
  pluginApi,
  rootRef,
  compact,
  startOpen,
  action,
  colourAction,
  selection,
  headerExtras,
}: MediaStripOptions) => {
  const panel = useMediaStripState(rootRef, compact, startOpen);
  const available = !!pluginApi?.mediaPicker.list;

  /** Onto the element, or a new one when there is none */
  const applyMedia = useCallback(
    (picked: MediaPickerResult, target: string | null, at?: StagePoint) => {
      const fill = mediaToFill(picked);
      if (!fill) return;
      if (target) {
        // As the inspector does for a fresh fill, e.g. slides' play-once videos
        const withDefaults = applyFillDefaults(
          insertDefaults ?? NO_INSERT_DEFAULTS,
          fill,
        );
        onChange(setElementFill(doc, target, withDefaults));
        setSelectedIds([target]);
      } else {
        const result = addMediaElement(doc, fill, {
          center: at,
          defaults: insertDefaults,
        });
        onChange(result.doc);
        setSelectedIds([result.id]);
      }
    },
    [doc, onChange, setSelectedIds, insertDefaults],
  );

  /** An element id, or the whole stage when `action` takes the drop */
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const stagePoint = (e: DragEvent): StagePoint | null => {
    const surface = rootRef.current?.querySelector(".lay--editor-surface");
    const box = surface?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return null;
    return {
      x: ((e.clientX - box.left) / box.width) * 100,
      y: ((e.clientY - box.top) / box.height) * 100,
    };
  };

  const isMediaDrag = (e: DragEvent) =>
    e.dataTransfer.types.includes(MEDIA_DRAG_TYPE);

  // The editor owns its item nodes, so mark the target on the DOM directly
  useEffect(() => {
    if (!dropTargetId) return;
    const node = rootRef.current?.querySelector(
      dropTargetId === STAGE_DROP
        ? ".lay--editor"
        : `[data-lay-id="${CSS.escape(dropTargetId)}"]`,
    );
    node?.classList.add("lay--editor-item--drop-target");
    return () => node?.classList.remove("lay--editor-item--drop-target");
  }, [dropTargetId, rootRef]);

  /** Spread onto the canvas */
  const dropHandlers = available
    ? {
        onDragOver: (e: DragEvent) => {
          if (!isMediaDrag(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          const point = stagePoint(e);
          const target = point ? mediaDropTarget(doc, point) : null;
          setDropTargetId(target ?? (action ? STAGE_DROP : null));
        },
        onDragLeave: (e: DragEvent) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setDropTargetId(null);
          }
        },
        onDrop: (e: DragEvent) => {
          if (!isMediaDrag(e)) return;
          e.preventDefault();
          setDropTargetId(null);
          let picked: MediaPickerResult;
          try {
            picked = JSON.parse(e.dataTransfer.getData(MEDIA_DRAG_TYPE));
          } catch {
            return;
          }
          const point = stagePoint(e);
          const target = point ? mediaDropTarget(doc, point) : null;
          if (!target && action) action(picked);
          else applyMedia(picked, target, point ?? undefined);
        },
      }
    : {};

  const strip =
    available && pluginApi ? (
      <MediaStrip
        api={pluginApi}
        onApply={(picked) =>
          action
            ? action(picked)
            : applyMedia(picked, mediaClickTarget(doc, selectedIds))
        }
        onNone={action ? () => action(null) : undefined}
        onColour={colourAction}
        selection={selection}
        headerExtras={headerExtras}
        onHide={compact ? undefined : () => panel.setOpen(false)}
        className="flex-1 py-2"
      />
    ) : null;

  return { strip, panel, dropHandlers };
};
