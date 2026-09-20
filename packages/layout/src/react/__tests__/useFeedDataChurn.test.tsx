import { registerFeedDataProvider } from "@repo/base-plugin/client";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { LayoutFeed } from "../../schema/feed";
import { useFeedData } from "../useFeedData";

const feed: LayoutFeed = {
  name: "slide",
  source: { kind: "scene", rendererId: "2", sceneId: "scene-1" },
  derivation: null,
};

/**
 * `useData()` is a valtio snapshot, so it changes identity whenever ANY part
 * of the project changes. A resolver built from it does too, and anything
 * keyed on that identity would restart on every unrelated edit.
 */
describe("useFeedData churn", () => {
  it("keeps one animation loop across unrelated re-renders", async () => {
    registerFeedDataProvider("slides", {
      bindings: [],
      getData: () => ({ notes: "x" }),
      isLive: () => true,
    });

    const raf = vi.spyOn(window, "requestAnimationFrame");
    const cancel = vi.spyOn(window, "cancelAnimationFrame");

    const { rerender, unmount } = renderHook(
      () =>
        // A fresh resolver each render, as `useCallback(..., [data])` gives.
        useFeedData([feed], () => [
          { pluginName: "slides", sceneData: {}, rendererData: {} },
        ]),
      { initialProps: {} },
    );

    await act(async () => {
      rerender({});
      rerender({});
    });

    // The loop is never torn down by a re-render, only by unmount.
    expect(cancel).not.toHaveBeenCalled();

    raf.mockRestore();
    cancel.mockRestore();
    unmount();
  });

  it("runs no loop at all when nothing is live", () => {
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    registerFeedDataProvider("slides", {
      bindings: [],
      getData: () => ({ notes: "x" }),
    });

    const { rerender } = renderHook(() =>
      useFeedData([feed], () => [
        { pluginName: "slides", sceneData: {}, rendererData: {} },
      ]),
    );
    rerender();

    expect(cancel).not.toHaveBeenCalled();
    cancel.mockRestore();
  });

  it("calls getData once per feed per render", () => {
    const getData = vi.fn(() => ({ notes: "x" }));
    registerFeedDataProvider("slides", { bindings: [], getData });

    renderHook(() =>
      useFeedData([feed], () => [
        { pluginName: "slides", sceneData: {}, rendererData: {} },
      ]),
    );

    expect(getData).toHaveBeenCalledTimes(1);
  });
});
