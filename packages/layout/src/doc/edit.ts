/**
 * Pure, immutable edits to a LayoutDoc.
 */
import { LayoutDoc } from "../schema/document";
import { LayoutElement, TextElement } from "../schema/element";
import { Paint } from "../schema/paint";
import { Rect } from "../schema/rect";
import { TextStylePatch } from "../schema/style";

/**
 * Deep clone AND strip `undefined`.
 *
 * Both halves matter when the result is persisted through valtio-yjs, which
 * cannot represent `undefined`; and cloning stops an edit from mutating a
 * module-level template object for the rest of the session.
 */
export const cloneDoc = (doc: LayoutDoc): LayoutDoc =>
  JSON.parse(JSON.stringify(doc)) as LayoutDoc;

export const findElement = (doc: LayoutDoc, id: string): LayoutElement | null =>
  doc.elements.find((e) => e.id === id) ?? null;

export const mapElement = (
  doc: LayoutDoc,
  id: string,
  fn: (element: LayoutElement) => LayoutElement,
): LayoutDoc => ({
  ...doc,
  elements: doc.elements.map((e) => (e.id === id ? fn(e) : e)),
});

/** Patch fields common to every element kind (rect, hidden, opacity, ...). */
export const patchElement = (
  doc: LayoutDoc,
  id: string,
  patch: Partial<LayoutElement>,
): LayoutDoc =>
  mapElement(doc, id, (e) => ({ ...e, ...patch }) as LayoutElement);

export const patchRect = (
  doc: LayoutDoc,
  id: string,
  patch: Partial<Rect>,
): LayoutDoc =>
  mapElement(doc, id, (e) => ({ ...e, rect: { ...e.rect, ...patch } }));

/** No-op on non-text elements, so callers need not narrow first. */
export const patchTextStyle = (
  doc: LayoutDoc,
  id: string,
  patch: TextStylePatch,
): LayoutDoc =>
  mapElement(doc, id, (e) =>
    e.type === "text" ? { ...e, style: { ...e.style, ...patch } } : e,
  );

export const patchTextElement = (
  doc: LayoutDoc,
  id: string,
  patch: Partial<Omit<TextElement, "type" | "style">>,
): LayoutDoc =>
  mapElement(doc, id, (e) => (e.type === "text" ? { ...e, ...patch } : e));

export const setElementFill = (
  doc: LayoutDoc,
  id: string,
  fill: Paint | null,
): LayoutDoc => patchElement(doc, id, { fill });

/** Solid fills only; anything else has no single colour to report. */
export const getSolidFillColor = (
  doc: LayoutDoc,
  id: string,
  fallback = "#000000",
): string => {
  const el = findElement(doc, id);
  if (el && el.fill && el.fill.type === "solid") return el.fill.color;
  return fallback;
};

// ---------------------------------------------------------------------------
// Structure. Array order is paint order: index 0 is furthest back.
// ---------------------------------------------------------------------------

export const insertElement = (
  doc: LayoutDoc,
  element: LayoutElement,
  index?: number,
): LayoutDoc => {
  const elements = [...doc.elements];
  elements.splice(index ?? elements.length, 0, element);
  return { ...doc, elements };
};

export const removeElement = (doc: LayoutDoc, id: string): LayoutDoc => ({
  ...doc,
  elements: doc.elements.filter((e) => e.id !== id),
});

const uniqueId = (doc: LayoutDoc, base: string): string => {
  let n = 2;
  let candidate = `${base}-${n}`;
  while (doc.elements.some((e) => e.id === candidate)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
};

/** Returns the new doc and the new id, so callers can select the copy. */
export const duplicateElement = (
  doc: LayoutDoc,
  id: string,
): { doc: LayoutDoc; id: string | null } => {
  const source = findElement(doc, id);
  if (!source) return { doc, id: null };

  const copy = JSON.parse(JSON.stringify(source)) as LayoutElement;
  copy.id = uniqueId(doc, id);
  // Offset so the duplicate is visibly distinct rather than exactly stacked.
  copy.rect = {
    ...copy.rect,
    x: Math.min(copy.rect.x + 2, Math.max(0, 100 - copy.rect.w)),
    y: Math.min(copy.rect.y + 2, Math.max(0, 100 - copy.rect.h)),
  };

  const index = doc.elements.findIndex((e) => e.id === id);
  return { doc: insertElement(doc, copy, index + 1), id: copy.id };
};

export type ReorderDirection = "forward" | "backward" | "front" | "back";

export const reorderElement = (
  doc: LayoutDoc,
  id: string,
  direction: ReorderDirection,
): LayoutDoc => {
  const index = doc.elements.findIndex((e) => e.id === id);
  if (index === -1) return doc;

  const target =
    direction === "forward"
      ? index + 1
      : direction === "backward"
        ? index - 1
        : direction === "front"
          ? doc.elements.length - 1
          : 0;

  if (target === index || target < 0 || target >= doc.elements.length) {
    return doc;
  }

  const elements = [...doc.elements];
  const [moved] = elements.splice(index, 1);
  elements.splice(target, 0, moved!);
  return { ...doc, elements };
};

// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<LayoutElement["type"], string> = {
  text: "Text",
  image: "Image",
  shape: "Shape",
};

export const elementLabel = (element: LayoutElement): string =>
  element.name ?? TYPE_LABELS[element.type];
