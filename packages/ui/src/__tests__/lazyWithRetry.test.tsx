// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { importWithRetry, lazyWithRetry } from "../lazyWithRetry";

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

describe("lazyWithRetry", () => {
  const reload = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    sessionStorage.clear();
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
    const LazyView = lazyWithRetry(loader);

    render(<LazyView />);
    await act(() => vi.runAllTimersAsync());

    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Unable to show this view")).toBeNull();
  });

  it("shows a reload button when the page already reloaded recently", async () => {
    sessionStorage.setItem("lazyWithRetry:reloadedAt", String(Date.now()));
    const loader = vi.fn().mockRejectedValue(loadError());
    const LazyView = lazyWithRetry(loader);

    render(<LazyView />);
    await act(() => vi.runAllTimersAsync());

    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText("Unable to show this view")).toBeTruthy();
    expect(window.reportError).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Reload page"));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload while offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const loader = vi.fn().mockRejectedValue(loadError());
    const LazyView = lazyWithRetry(loader);

    render(<LazyView />);
    await act(() => vi.runAllTimersAsync());

    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText("Unable to show this view")).toBeTruthy();
  });
});
