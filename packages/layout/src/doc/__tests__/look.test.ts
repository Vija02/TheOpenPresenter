import { describe, expect, it } from "vitest";

import { bindLookTarget, defaultConfidenceLook } from "../look";

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
