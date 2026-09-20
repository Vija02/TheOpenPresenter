import { registerFeedDataProvider } from "@repo/base-plugin/client";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { LayoutFeed } from "../../schema/feed";
import { useFeedData } from "../useFeedData";

const feed = (name: string, offset = 0): LayoutFeed => ({
  name,
  source: { kind: "scene", rendererId: "2", sceneId: "scene-1" },
  derivation: offset === 0 ? null : { params: { offset } },
});

/** One plugin in scope, whose notes depend on the feed's offset. */
const resolveSources = () => [
  {
    pluginName: "slides",
    sceneData: { notes: ["Now", "Next"] },
    rendererData: { index: 0 },
  },
];

beforeEach(() => {
  registerFeedDataProvider("slides", {
    bindings: [{ key: "notes", label: "Speaker notes", type: "text" }],
    getData: ({ sceneData, rendererData, derivation }) => {
      const offset = Number(derivation?.params?.offset ?? 0);
      return { notes: sceneData.notes[rendererData.index + offset] ?? "" };
    },
  });
});

describe("useFeedData", () => {
  it("namespaces what the provider returns", () => {
    const { result } = renderHook(() =>
      useFeedData([feed("slide")], resolveSources),
    );

    expect(result.current).toEqual({ "slide.notes": "Now" });
  });

  it("applies each feed's own derivation", () => {
    const { result } = renderHook(() =>
      useFeedData([feed("live"), feed("next", 1)], resolveSources),
    );

    expect(result.current).toEqual({
      "live.notes": "Now",
      "next.notes": "Next",
    });
  });

  it("re-reads a live provider from the animation loop", async () => {
    let notes = "initial";
    registerFeedDataProvider("slides", {
      bindings: [],
      getData: () => ({ notes }),
      // Stands in for autoplay: the value changes without the document doing so.
      isLive: () => true,
    });

    const { result } = renderHook(() =>
      useFeedData([feed("slide")], resolveSources),
    );
    expect(result.current).toEqual({ "slide.notes": "initial" });

    notes = "ticked";
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    expect(result.current).toEqual({ "slide.notes": "ticked" });
  });

  it("ignores a plugin that registered no provider", () => {
    const { result } = renderHook(() =>
      useFeedData([feed("slide")], () => [
        { pluginName: "unknown", sceneData: {}, rendererData: {} },
      ]),
    );

    expect(result.current).toEqual({});
  });
});
