import { mapElement } from "../../doc/edit";
import { LayoutDoc } from "../../schema/document";
import { FillPaint } from "../../schema/paint";

/** Drag payload type: a `MediaPickerResult` as JSON */
export const MEDIA_DRAG_TYPE = "application/x-layout-media";

export type StagePoint = { x: number; y: number };

/** Where dropped media lands: the topmost visible shape under the point */
export const mediaDropTarget = (
  doc: LayoutDoc,
  point: StagePoint,
): string | null => {
  for (let i = doc.elements.length - 1; i >= 0; i--) {
    const element = doc.elements[i]!;
    if (element.hidden || element.type !== "shape" || element.kind === "line")
      continue;

    const { x, y, w, h } = element.rect;
    if (point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h)
      return element.id;
  }
  return null;
};

/** Media chosen with one element selected goes onto it, box fill for text */
export const mediaClickTarget = (
  doc: LayoutDoc,
  selectedIds: string[],
): string | null => {
  if (selectedIds.length !== 1) return null;
  const element = doc.elements.find((e) => e.id === selectedIds[0]);
  if (!element || element.type === "host") return null;
  if (element.type === "shape" && element.kind === "line") return null;
  return element.id;
};

export const setElementFill = (
  doc: LayoutDoc,
  id: string,
  fill: FillPaint,
): LayoutDoc => mapElement(doc, id, (element) => ({ ...element, fill }));
