import { describe, expect, it } from "vitest";

import { createHostElement, createLayoutDoc } from "../../schema/defaults";
import { layoutElementValidator } from "../../schema/element";
import { setHostSource } from "../edit";
import {
  createSimpleOutputLayout,
  nextOutputId,
  outputProgramId,
  readOutputs,
  simpleOutputInfo,
} from "../outputs";

// Stored before outputs: host elements had no look or followOverlay
const legacyLayout = (() => {
  const doc = createLayoutDoc({
    elements: [
      createHostElement({
        id: "mirror",
        source: { kind: "screen", rendererId: "1" },
      }),
      createHostElement({
        id: "own",
        source: { kind: "scene", rendererId: "2", sceneId: "scene_a" },
      }),
    ],
  });
  return {
    ...doc,
    elements: doc.elements.map((element) => {
      const { look: _look, followOverlay: _follow, ...rest } = element as any;
      return rest;
    }),
  } as typeof doc;
})();

describe("readOutputs", () => {
  it("gives a new project a main output on program 1", () => {
    const outputs = readOutputs({ renderer: { "1": { layout: null } } });
    expect(Object.keys(outputs)).toEqual(["1"]);
    expect(outputs["1"]!.name).toBe("Main");
    expect(simpleOutputInfo(outputs["1"]!.layout)).toEqual({
      programId: "1",
      look: "main",
      followOverlay: true,
    });
  });

  it("keeps an old screen's custom layout as its output", () => {
    const outputs = readOutputs({
      renderer: {
        "1": { layout: null },
        "2": { layout: { enabled: true, doc: legacyLayout } },
        "3": { layout: { enabled: false, doc: legacyLayout } },
      },
    });

    expect(Object.keys(outputs)).toEqual(["1", "2", "3"]);
    const custom = outputs["2"]!.layout;
    expect(simpleOutputInfo(custom)).toBeNull();
    // It never went black with screen 1, only with itself
    expect(
      custom.elements.map((e) => e.type === "host" && e.followOverlay),
    ).toEqual([false, true]);
    // A switched-off layout showed the screen's own scenes
    expect(simpleOutputInfo(outputs["3"]!.layout)?.programId).toBe("3");
  });

  it("prefers stored outputs", () => {
    const stored = {
      "1": { name: "Main", layout: createSimpleOutputLayout() },
      "4": {
        name: "Confidence",
        layout: createSimpleOutputLayout({
          look: "confidence",
          followOverlay: false,
        }),
      },
    };
    const outputs = readOutputs({
      renderer: { "1": { layout: null } },
      outputs: stored,
    });
    expect(outputs).toBe(stored);
    expect(simpleOutputInfo(outputs["4"]!.layout)).toEqual({
      programId: "1",
      look: "confidence",
      followOverlay: false,
    });
    expect(nextOutputId(outputs)).toBe("5");
  });
});

describe("outputProgramId", () => {
  it("is the program the output's first box plays", () => {
    const outputs = readOutputs({
      renderer: {
        "1": { layout: null },
        "2": { layout: { enabled: true, doc: legacyLayout } },
      },
    });
    expect(outputProgramId(outputs, "1")).toBe("1");
    expect(outputProgramId(outputs, "2")).toBe("1");
    // Not an output: taken as a program
    expect(outputProgramId(outputs, "7")).toBe("7");
  });
});

describe("older documents", () => {
  it("keeps the first layout format's mirror off the other screen's Black", () => {
    const outputs = readOutputs({
      renderer: {
        "1": { layout: null },
        "2": {
          layout: {
            enabled: true,
            aspectRatio: { width: 16, height: 9 },
            items: [
              {
                id: "item_1",
                type: "screenItem",
                sourceRendererId: "1",
                position: { x: 0, y: 0, width: 100, height: 100 },
                derivation: null,
              },
            ],
          } as never,
        },
      },
    });
    const [box] = outputs["2"]!.layout.elements;
    expect(box?.type === "host" && box.followOverlay).toBe(false);
  });

  it("reads host boxes saved without look or followOverlay", () => {
    const {
      look: _look,
      followOverlay: _follow,
      ...old
    } = createHostElement({
      id: "old",
      source: { kind: "screen", rendererId: "1" },
    });
    const parsed = layoutElementValidator.parse(old);
    expect(
      parsed.type === "host" && [parsed.look, parsed.followOverlay],
    ).toEqual([null, true]);
  });

  it("drops a box's look when it stops showing what's live", () => {
    const doc = createSimpleOutputLayout({ look: "confidence" });
    const next = setHostSource(doc, "program", {
      kind: "scene",
      rendererId: "1",
      sceneId: "scene_a",
    });
    const [box] = next.elements;
    expect(box?.type === "host" && box.look).toBeNull();
  });
});
