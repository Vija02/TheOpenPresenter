import { cascadeRect, freshElementId, insertElement } from "../doc/edit";
import { MIN_RECT_SIZE } from "../geometry/rect";
import { createShapeElement, createTextElement } from "../schema/defaults";
import { LayoutDoc } from "../schema/document";
import { LayoutElement, ShapeKind } from "../schema/element";
import { FillPaint, imagePaint, solidPaint, videoPaint } from "../schema/paint";
import { Rect } from "../schema/rect";
import { LayoutPluginApi, pickImage, pickVideo } from "./pluginApi";

/**
 * Defaults of what the button inserts
 */

const centered = (w: number, h: number): Rect => ({
  x: (100 - w) / 2,
  y: (100 - h) / 2,
  w,
  h,
});

const TEXT_RECT = centered(60, 20);
const SHAPE_RECT = centered(40, 30);
const MEDIA_RECT = centered(50, 50);
const LINE_RECT: Rect = { x: 20, y: 50, w: 60, h: MIN_RECT_SIZE };

const SHAPE_FILL = solidPaint("#3b82f6");
const LINE_STROKE = { paint: solidPaint("#ffffff"), width: 0.4 } as const;

export type AddResult = { doc: LayoutDoc; id: string };

/** New elements go on top of the paint order, and are returned selected. */
const add = (
  doc: LayoutDoc,
  base: string,
  build: (id: string, rect: Rect) => LayoutElement,
  rect: Rect,
): AddResult => {
  const id = freshElementId(doc, base);
  const element = build(id, cascadeRect(doc, rect));
  return { doc: insertElement(doc, element), id };
};

export const addTextElement = (doc: LayoutDoc): AddResult =>
  add(
    doc,
    "text",
    (id, rect) =>
      createTextElement({
        id,
        rect,
        content: "Your text here",
        fit: "shrinkToFit",
      }),
    TEXT_RECT,
  );

export const addShape = (doc: LayoutDoc, kind: ShapeKind): AddResult =>
  add(
    doc,
    kind,
    (id, rect) =>
      createShapeElement({
        id,
        kind,
        rect,
        ...(kind === "line"
          ? { stroke: { ...LINE_STROKE, align: "center" as const } }
          : { fill: SHAPE_FILL }),
      }),
    kind === "line" ? LINE_RECT : SHAPE_RECT,
  );

const addMedia = (doc: LayoutDoc, base: string, fill: FillPaint): AddResult =>
  add(
    doc,
    base,
    (id, rect) => createShapeElement({ id, kind: "rect", rect, fill }),
    MEDIA_RECT,
  );

export const addImageElement = async (
  doc: LayoutDoc,
  api: LayoutPluginApi,
): Promise<AddResult | null> => {
  const src = await pickImage(api);
  if (!src) return null;
  return addMedia(doc, "image", imagePaint(src));
};

export const addVideoElement = async (
  doc: LayoutDoc,
  api: LayoutPluginApi,
): Promise<AddResult | null> => {
  const video = await pickVideo(api);
  if (!video) return null;
  return addMedia(doc, "video", videoPaint(video));
};
