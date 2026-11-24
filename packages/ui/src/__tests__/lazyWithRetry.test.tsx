// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Component, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NewVersionError,
  importOrReload,
  importWithRetry,
  lazyWithRetry,
} from "../lazyWithRetry";

const View = () => <div>view loaded</div>;
const loadError = () => new TypeError("Importing a module script failed.");

beforeEach(() => {
  vi.useFakeTimers();
  window.reportError = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("importWithRetry", () => {
  it("retries a failed load", async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(loadError())
      .mockResolvedValueOnce({ default: View });

    const result = importWithRetry(loader);
    await vi.runAllTimersAsync();

    await expect(result).resolves.toEqual({ default: View });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("throws the last error when all attempts fail", async () => {
    const loader = vi.fn().mockRejectedValue(loadError());

    const result = importWithRetry(loader, 3);
    const assertion = expect(result).rejects.toThrow(
      "Importing a module script failed.",
    );
    await vi.runAllTimersAsync();

    await assertion;
    expect(loader).toHaveBeenCalledTimes(3);
  });
});

describe("importWithRetry when the file is gone", () => {
  const chunkUrl = "https://example.com/assets/View-abc123.js";
  const chunkError = () =>
    new TypeError(`Failed to fetch dynamically imported module: ${chunkUrl}`);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["a 403", new Response("", { status: 403 })],
    ["a 404", new Response("", { status: 404 })],
    [
      "the HTML fallback",
      new Response("<html></html>", {
        headers: { "content-type": "text/html" },
      }),
    ],
  ])("fails without retrying on %s", async (_, response) => {
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    const loader = vi.fn().mockRejectedValue(chunkError());

    const result = importWithRetry(loader);
    const assertion = expect(result).rejects.toBeInstanceOf(NewVersionError);
    await vi.runAllTimersAsync();

    await assertion;
    expect(loader).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(chunkUrl, { cache: "no-store" });
  });

  it("keeps retrying when the file is still there", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("export {}", {
          headers: { "content-type": "text/javascript" },
        }),
      ),
    );
    const loader = vi.fn().mockRejectedValue(chunkError());

    const result = importWithRetry(loader, 2);
    const assertion = expect(result).rejects.toThrow();
    await vi.runAllTimersAsync();

    await assertion;
    expect(loader).toHaveBeenCalledTimes(1);
    // The retry imports the cache-busted URL directly
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("lazyWithRetry", () => {
  const reload = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    history.replaceState(null, "");
    reload.mockClear();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("reloads the page once when the view does not load", async () => {
    const loader = vi.fn().mockRejectedValue(loadError());
    const LazyView = lazyWithRetry(loader, { autoReload: true });

    render(<LazyView />);
    await act(() => vi.runAllTimersAsync());

    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Couldn't load this view")).toBeNull();
  });

  it("shows a retry button when the page already reloaded recently", async () => {
    history.replaceState({ "lazyWithRetry:reloadedAt": Date.now() }, "");
    const loader = vi.fn().mockRejectedValue(loadError());
    const LazyView = lazyWithRetry(loader, { autoReload: true });

    render(<LazyView />);
    await act(() => vi.runAllTimersAsync());

    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText("Couldn't load this view")).toBeTruthy();
    expect(window.reportError).toHaveBeenCalledTimes(1);
  });

  it("loads the view when Try again works", async () => {
    // Fails all 4 attempts of the first load, then works
    const loader = vi.fn().mockResolvedValue({ default: View });
    for (let i = 0; i < 4; i++) loader.mockRejectedValueOnce(loadError());
    const LazyView = lazyWithRetry(loader);

    render(<LazyView />);
    await act(() => vi.runAllTimersAsync());
    expect(screen.getByText("Couldn't load this view")).toBeTruthy();

    fireEvent.click(screen.getByText("Try again"));
    await act(() => vi.runAllTimersAsync());

    expect(screen.getByText("view loaded")).toBeTruthy();
    expect(reload).not.toHaveBeenCalled();
  });

  it("lets a crash inside the view reach the boundary above", async () => {
    const Crash = () => {
      throw new Error("bad scene data");
    };
    const LazyView = lazyWithRetry(() => Promise.resolve({ default: Crash }));
    const Outer = class extends Component<
      { children: ReactNode },
      { caught: string | null }
    > {
      state = { caught: null as string | null };
      static getDerivedStateFromError(error: Error) {
        return { caught: error.message };
      }
      render() {
        return this.state.caught ?? this.props.children;
      }
    };
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <Outer>
        <LazyView />
      </Outer>,
    );
    await act(() => vi.runAllTimersAsync());

    expect(screen.getByText("bad scene data")).toBeTruthy();
    expect(screen.queryByText("Couldn't load this view")).toBeNull();
  });

  it("importOrReload reloads instead of rejecting", async () => {
    const loader = vi.fn().mockRejectedValue(loadError());
    const onSettled = vi.fn();

    importOrReload(loader).then(onSettled, onSettled);
    await vi.runAllTimersAsync();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("asks to reload instead of reloading by default", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 404 })),
    );
    const loader = vi
      .fn()
      .mockRejectedValue(
        new TypeError(
          "Failed to fetch dynamically imported module: https://example.com/a.js",
        ),
      );
    const LazyView = lazyWithRetry(loader);

    render(<LazyView />);
    await act(() => vi.runAllTimersAsync());
    vi.unstubAllGlobals();

    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText("New version available")).toBeTruthy();
    expect(window.reportError).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Reload page"));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload while offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const loader = vi.fn().mockRejectedValue(loadError());
    const LazyView = lazyWithRetry(loader, { autoReload: true });

    render(<LazyView />);
    await act(() => vi.runAllTimersAsync());

    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText("Couldn't load this view")).toBeTruthy();
  });
});
