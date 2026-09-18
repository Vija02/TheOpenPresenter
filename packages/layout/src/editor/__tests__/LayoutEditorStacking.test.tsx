import { render } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { Rect } from "../../schema/rect";
import { EditorItem, LayoutEditor } from "../LayoutEditor";

/**
 * Reordering layers must not MOVE a node in the DOM.
 *
 * Relocating an iframe in the document reloads it — browser behaviour React
 * cannot opt out of — which tore down a live host preview on every "bring
 * forward". So DOM order is frozen per id and paint order is carried by
 * z-index instead.
 */

// Stage renders nothing until it measures a non-zero box, and jsdom reports
// every element as 0x0. @react-hook/size reads offsetWidth/offsetHeight.
beforeAll(() => {
  for (const prop of ["offsetWidth", "offsetHeight"] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      value: prop === "offsetWidth" ? 1920 : 1080,
    });
  }
});

const rect: Rect = { x: 0, y: 0, w: 10, h: 10 };

const item = (id: string): EditorItem => ({ id, rect });

const idsInDomOrder = (container: HTMLElement) =>
  [...container.querySelectorAll("[data-lay-id]")].map(
    (node) => (node as HTMLElement).dataset.layId,
  );

const zIndexOf = (container: HTMLElement, id: string) =>
  (container.querySelector(`[data-lay-id="${id}"]`) as HTMLElement).style
    .zIndex;

const renderEditor = (items: EditorItem[]) =>
  render(
    <LayoutEditor
      items={items}
      selectedIds={[]}
      onSelectionChange={() => {}}
      onChange={() => {}}
      renderItem={() => null}
    />,
  );

describe("LayoutEditor stacking", () => {
  it("keeps DOM order fixed when layers are reordered", () => {
    const items = [item("a"), item("b"), item("c")];
    const { container, rerender } = renderEditor(items);

    expect(idsInDomOrder(container)).toEqual(["a", "b", "c"]);
    const nodeB = container.querySelector('[data-lay-id="b"]');

    // "Bring to front" on b: it moves to the end of the array.
    rerender(
      <LayoutEditor
        items={[item("a"), item("c"), item("b")]}
        selectedIds={[]}
        onSelectionChange={() => {}}
        onChange={() => {}}
        renderItem={() => null}
      />,
    );

    // Same DOM position, and critically the very same element instance: a
    // reparented iframe would reload.
    expect(idsInDomOrder(container)).toEqual(["a", "b", "c"]);
    expect(container.querySelector('[data-lay-id="b"]')).toBe(nodeB);
  });

  it("expresses the new paint order with z-index", () => {
    const { container, rerender } = renderEditor([
      item("a"),
      item("b"),
      item("c"),
    ]);

    expect(zIndexOf(container, "b")).toBe("1");

    rerender(
      <LayoutEditor
        items={[item("a"), item("c"), item("b")]}
        selectedIds={[]}
        onSelectionChange={() => {}}
        onChange={() => {}}
        renderItem={() => null}
      />,
    );

    // b is now last in paint order, so it outranks c.
    expect(zIndexOf(container, "b")).toBe("2");
    expect(zIndexOf(container, "c")).toBe("1");
  });

  it("appends newly added items without disturbing existing nodes", () => {
    const { container, rerender } = renderEditor([item("a"), item("b")]);
    const nodeA = container.querySelector('[data-lay-id="a"]');

    rerender(
      <LayoutEditor
        items={[item("new"), item("a"), item("b")]}
        selectedIds={[]}
        onSelectionChange={() => {}}
        onChange={() => {}}
        renderItem={() => null}
      />,
    );

    expect(idsInDomOrder(container)).toEqual(["a", "b", "new"]);
    expect(container.querySelector('[data-lay-id="a"]')).toBe(nodeA);
    // ...but it still paints behind both, as its array position says.
    expect(zIndexOf(container, "new")).toBe("0");
  });
});
