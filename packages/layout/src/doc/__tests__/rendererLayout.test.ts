import { describe, expect, it } from "vitest";

import { createHostElement } from "../../schema/defaults";
import { createLayoutDoc } from "../../schema/defaults";
import { createRendererLayout, readRendererLayoutDoc } from "../rendererLayout";

const legacy = {
  enabled: true,
  aspectRatio: { width: 4, height: 3 },
  items: [
    {
      id: "layoutitem_main",
      type: "sceneItem" as const,
      sourceRendererId: "1",
      sceneId: "scene_a",
      position: { x: 0, y: 0, width: 70, height: 100 },
      derivation: null,
      label: "Main",
    },
    {
      id: "layoutitem_next",
      type: "screenItem" as const,
      sourceRendererId: "2",
      position: { x: 70, y: 0, width: 30, height: 50 },
      derivation: { offset: 1 },
    },
  ],
};

describe("readRendererLayoutDoc", () => {
  it("converts a legacy confidence monitor into host elements", () => {
    const doc = readRendererLayoutDoc(legacy)!;

    expect(doc.aspectRatio).toEqual({ width: 4, height: 3 });
    expect(doc.fitMode).toBe("letterbox");
    expect(doc.elements).toHaveLength(2);

    const [main, next] = doc.elements;

    expect(main).toMatchObject({
      id: "layoutitem_main",
      type: "host",
      name: "Main",
      rect: { x: 0, y: 0, w: 70, h: 100 },
      source: { kind: "scene", rendererId: "1", sceneId: "scene_a" },
      derivation: null,
    });

    expect(next).toMatchObject({
      id: "layoutitem_next",
      type: "host",
      rect: { x: 70, y: 0, w: 30, h: 50 },
      source: { kind: "screen", rendererId: "2" },
      derivation: { params: { offset: 1 } },
    });
  });

  it("returns a modern doc untouched", () => {
    const doc = createLayoutDoc({
      elements: [
        createHostElement({
          id: "host-1",
          source: { kind: "screen", rendererId: "2" },
        }),
      ],
    });

    expect(readRendererLayoutDoc({ enabled: true, doc })).toBe(doc);
  });

  it("has nothing to read when the screen has no layout", () => {
    expect(readRendererLayoutDoc(null)).toBeNull();
    expect(readRendererLayoutDoc({ enabled: false })).toBeNull();
  });

  it("creates an empty letterboxed layout for a new screen", () => {
    const layout = createRendererLayout();

    expect(layout.enabled).toBe(true);
    expect(layout.doc.elements).toEqual([]);
    expect(layout.doc.fitMode).toBe("letterbox");
  });
});
