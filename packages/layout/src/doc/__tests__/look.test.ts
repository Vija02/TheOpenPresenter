import { describe, expect, it } from "vitest";

import { createLayoutDoc } from "../../schema/defaults";
import {
  bindLookTarget,
  defaultConfidenceLook,
  listLooks,
  newProjectLookKey,
  pluginLookChoice,
  resolvePluginLook,
  rootLookKey,
  selfHost,
} from "../look";

const content = { rendererId: "1", sceneId: "scene_a", pluginId: "plugin_a" };

describe("bindLookTarget", () => {
  it("points every content host and feed at the plugin", () => {
    const look = {
      ...defaultConfidenceLook(),
      feeds: [
        {
          name: "slides",
          source: { kind: "self" as const },
          derivation: null,
        },
        {
          name: "other",
          source: { kind: "screen" as const, rendererId: "2" },
          derivation: null,
        },
      ],
    };
    const bound = bindLookTarget(look, content);

    const sources = bound.elements.flatMap((e) =>
      e.type === "host" ? [e.source] : [],
    );
    expect(sources).toEqual([
      { kind: "plugin", ...content },
      { kind: "plugin", ...content },
    ]);
    expect(bound.feeds?.map((f) => f.source)).toEqual([
      { kind: "plugin", ...content },
      { kind: "screen", rendererId: "2" },
    ]);
  });

  it("keeps the offsets apart", () => {
    const bound = bindLookTarget(defaultConfidenceLook(), content);
    const offsets = bound.elements.flatMap((e) =>
      e.type === "host" ? [e.derivation?.params?.offset] : [],
    );
    expect(offsets).toEqual([0, 1]);
  });
});

describe("resolvePluginLook", () => {
  const doc = (name: string) =>
    createLayoutDoc({
      elements: [
        selfHost({ id: name, name, rect: { x: 0, y: 0, w: 100, h: 100 } }),
      ],
    });
  const registered = [
    {
      pluginName: "slides",
      looks: [{ key: "confidence", name: "Confidence", doc: doc("built-in") }],
    },
  ];

  it("shows a project's own look's changes, else its base look", () => {
    const projectLooks = {
      confidence: { plugins: { lyrics: doc("project") } },
      "confidence-2": {
        name: "Back stage",
        base: "confidence",
        plugins: { bible: doc("own") },
      },
    };
    const name = (pluginName: string) =>
      resolvePluginLook(registered, projectLooks, pluginName, "confidence-2")
        ?.elements[0]?.id;

    expect(name("bible")).toBe("own");
    expect(name("lyrics")).toBe("project");
    expect(name("slides")).toBe("built-in");
    expect(name("timer")).toBeUndefined();
    expect(rootLookKey(projectLooks, "confidence-2")).toBe("confidence");
    expect(newProjectLookKey(projectLooks, "confidence")).toBe("confidence-3");
  });

  it("stops on a look that is its own base", () => {
    const projectLooks = { loop: { base: "loop", plugins: {} } };
    expect(resolvePluginLook(registered, projectLooks, "slides", "loop")).toBe(
      null,
    );
  });
});

describe("listLooks", () => {
  it("lists built-in looks, each before its copies, and which are off", () => {
    const looks = listLooks({
      overlay: { plugins: {}, hidden: true },
      "confidence-2": { name: "Back stage", base: "confidence", plugins: {} },
      "overlay-2": { name: "Lower third", base: "overlay", plugins: {} },
      // Changes to a built-in look aren't a look of their own
      confidence: { plugins: {} },
    });

    expect(looks.map((look) => look.key)).toEqual([
      "main",
      "confidence",
      "confidence-2",
      "overlay",
      "overlay-2",
    ]);
    expect(looks.find((look) => look.key === "overlay")?.hidden).toBe(true);
    expect(looks.find((look) => look.key === "confidence-2")).toMatchObject({
      name: "Back stage",
      type: "confidence",
      builtIn: false,
    });
  });
});

describe("plugin styles", () => {
  const doc = (name: string) =>
    createLayoutDoc({
      elements: [
        selfHost({ id: name, name, rect: { x: 0, y: 0, w: 100, h: 100 } }),
      ],
    });
  const registered = [
    {
      pluginName: "lyrics",
      looks: [
        { key: "confidence", name: "Live + next", doc: doc("default") },
        {
          key: "confidence",
          name: "Whole song",
          style: "whole-song",
          doc: doc("whole-song"),
        },
        { key: "overlay", name: "Lower third", doc: doc("lower-third") },
      ],
    },
  ];
  const shown = (projectLooks: Parameters<typeof resolvePluginLook>[1]) =>
    resolvePluginLook(registered, projectLooks, "lyrics", "confidence-2")
      ?.elements[0]?.id;

  it("shows the plugin's default style, else the one a look picks", () => {
    const own = { name: "Back", base: "confidence", plugins: {} };
    expect(shown({ "confidence-2": own })).toBe("default");
    expect(
      shown({ "confidence-2": { ...own, styles: { lyrics: "whole-song" } } }),
    ).toBe("whole-song");
    // A style the plugin no longer has
    expect(
      shown({ "confidence-2": { ...own, styles: { lyrics: "gone" } } }),
    ).toBe("default");
  });

  it("puts a change made for the look over any style", () => {
    const projectLooks = {
      "confidence-2": {
        name: "Back",
        base: "confidence",
        styles: { lyrics: "whole-song" },
        plugins: { lyrics: doc("own") },
      },
    };
    expect(shown(projectLooks)).toBe("own");
    expect(
      pluginLookChoice(registered, projectLooks, "lyrics", "confidence-2"),
    ).toEqual({ kind: "own" });
  });
});
