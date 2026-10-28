import { render } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { Rect } from "../../schema/rect";
import { EditorItem, LayoutEditor } from "../LayoutEditor";

/**
 * A Moveable group diffs its targets on every update and reads a repeated
 * node as moved, so it calls setState from componentDidUpdate forever and
 * React stops it with "Maximum update depth exceeded" (#185).
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

const renderEditor = (selectedIds: string[]) =>
  render(
    <LayoutEditor
      items={[item("a"), item("b")]}
      selectedIds={selectedIds}
      onSelectionChange={() => {}}
      onChange={() => {}}
      renderItem={() => null}
    />,
  );

describe("LayoutEditor selection", () => {
  it("survives a selection that repeats an id", () => {
    expect(() => renderEditor(["a", "a", "b"])).not.toThrow();
  });

  it("survives a selection that repeats an id after mount", () => {
    const { rerender } = renderEditor([]);

    expect(() =>
      rerender(
        <LayoutEditor
          items={[item("a"), item("b")]}
          selectedIds={["a", "b", "a"]}
          onSelectionChange={() => {}}
          onChange={() => {}}
          renderItem={() => null}
        />,
      ),
    ).not.toThrow();
  });
});
