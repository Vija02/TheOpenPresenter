// @vitest-environment jsdom
import { PluginAPIContext } from "@repo/base-plugin/client";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect, useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePluginAPI } from "../../pluginApi";

vi.mock("@repo/ui", () => ({
  importWithRetry: (load: () => unknown) => load(),
}));
vi.mock("../LayoutSlideRenderer", () => ({ LayoutSlideRenderer: () => null }));
vi.mock("../SlideVideoOverlay", () => ({ SlideVideoOverlay: () => null }));
vi.mock("../../Ink/InkLayer", () => ({ InkLayer: () => null }));
vi.mock("../GoogleSlideRenderer", () => ({ GoogleSlideRenderer: () => null }));
vi.mock("../PowerPointFallback", () => ({ PowerPointFallback: () => null }));

// Stands in for the image renderer: draws the imports it sees, and is
// loading until the test says an import's images arrived
const loaded = new Set<string>();
const loadedListeners = new Set<() => void>();
const markLoaded = (importId: string) => {
  loaded.add(importId);
  loadedListeners.forEach((l) => l());
};
vi.mock("../ImageRenderer", () => ({
  ImageRenderer: ({
    onLoadingChange,
  }: {
    onLoadingChange: (id: string, isLoading: boolean) => void;
  }) => {
    const pluginApi = usePluginAPI();
    const imports = pluginApi.scene.useData((x) => x.pluginData.imports);
    const ids = Object.keys(imports).sort().join(",");
    const ready = useSyncExternalStore(
      (l) => {
        loadedListeners.add(l);
        return () => loadedListeners.delete(l);
      },
      () => ids.split(",").every((id) => loaded.has(id)),
    );
    useEffect(() => {
      onLoadingChange("images", !ready);
    }, [ready, onLoadingChange]);
    return <div data-testid="deck">{ids}</div>;
  },
}));

const { default: Renderer } = await import("../index");

const deck = (importId: string, extra: object = {}) => ({
  importId,
  type: "pdf",
  fetchId: `fetch-${importId}`,
  thumbnailLinks: ["a"],
  slideClickCounts: [0],
  slideIds: ["0"],
  ...extra,
});

/** A scene store and the plugin API slice the renderer reads */
const setup = (imports: Record<string, object>) => {
  let scene = {
    pluginData: {
      imports,
      slideOrder: Object.keys(imports).map((id) => `${id}:0`),
    },
  };
  const listeners = new Set<() => void>();
  const setImports = (next: Record<string, object>) => {
    scene = {
      pluginData: {
        imports: next,
        slideOrder: Object.keys(next).map((id) => `${id}:0`),
      },
    };
    act(() => listeners.forEach((l) => l()));
  };
  const setAwarenessStateData = vi.fn();
  const pluginAPI = {
    scene: {
      useData: (fn?: (x: any) => any) => {
        const data = useSyncExternalStore(
          (l) => {
            listeners.add(l);
            return () => listeners.delete(l);
          },
          () => scene,
        );
        return fn ? fn(data) : data;
      },
    },
    renderer: {
      useData: (fn?: (x: any) => any) =>
        fn ? fn({ displayModes: {}, currentSlideIndex: 0 }) : {},
      useDerivationParam: (_: string, fallback: unknown) => fallback,
    },
    awareness: { setAwarenessStateData },
  };
  render(
    <PluginAPIContext.Provider value={{ pluginAPI: pluginAPI as any }}>
      <Renderer />
    </PluginAPIContext.Provider>,
  );
  return { setImports, setAwarenessStateData };
};

const decks = () =>
  screen.getAllByTestId("deck").map((el) => ({
    ids: el.textContent,
    hidden: el.closest<HTMLElement>("[style]")?.style.opacity === "0",
  }));

describe("replacing a deck", () => {
  beforeEach(() => {
    loaded.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("keeps the old deck up until the new one has loaded", () => {
    markLoaded("old");
    const { setImports } = setup({ old: deck("old") });
    const oldElement = screen.getByTestId("deck");

    setImports({ new: deck("new", { replaceImportId: "old" }) });
    expect(decks()).toEqual([
      { ids: "old", hidden: false },
      { ids: "new", hidden: true },
    ]);
    // The same element, so nothing it loaded is lost
    expect(screen.getAllByTestId("deck")[0]).toBe(oldElement);

    act(() => markLoaded("new"));
    expect(decks()).toEqual([{ ids: "new", hidden: false }]);
  });

  it("gives up waiting after a while", () => {
    markLoaded("old");
    const { setImports } = setup({ old: deck("old") });
    setImports({ new: deck("new", { replaceImportId: "old" }) });

    act(() => vi.advanceTimersByTime(15_000));
    expect(decks()).toEqual([{ ids: "new", hidden: false }]);
  });

  it("gives a deck replaced during a hold the full time", () => {
    markLoaded("a");
    const { setImports } = setup({ a: deck("a") });
    setImports({ b: deck("b", { replaceImportId: "a" }) });
    act(() => vi.advanceTimersByTime(10_000));
    setImports({ c: deck("c", { replaceImportId: "b" }) });

    act(() => vi.advanceTimersByTime(10_000));
    expect(decks()).toEqual([
      { ids: "a", hidden: false },
      { ids: "c", hidden: true },
    ]);
    act(() => vi.advanceTimersByTime(5_000));
    expect(decks()).toEqual([{ ids: "c", hidden: false }]);
  });

  it("doesn't wait for other changes", () => {
    markLoaded("a");
    const { setImports } = setup({ a: deck("a") });
    setImports({ a: deck("a"), b: deck("b") });
    expect(decks()).toEqual([{ ids: "a,b", hidden: false }]);
  });

  it("reports loading only for the deck that will show", () => {
    markLoaded("old");
    const { setImports, setAwarenessStateData } = setup({ old: deck("old") });
    setImports({ new: deck("new", { replaceImportId: "old" }) });
    expect(setAwarenessStateData).toHaveBeenLastCalledWith({ isLoading: true });
    act(() => markLoaded("new"));
    expect(setAwarenessStateData).toHaveBeenLastCalledWith({
      isLoading: false,
    });
  });
});
