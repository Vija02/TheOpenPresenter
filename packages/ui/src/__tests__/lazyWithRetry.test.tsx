import { act, fireEvent, render, screen } from "@testing-library/react";
import { Suspense } from "react";
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
  it("shows a retry button when the view does not load, and recovers", async () => {
    let failing = true;
    const loader = vi.fn(() =>
      failing
        ? Promise.reject(loadError())
        : Promise.resolve({ default: View }),
    );
    const LazyView = lazyWithRetry(loader);

    render(
      <Suspense fallback="loading">
        <LazyView />
      </Suspense>,
    );
    await act(() => vi.runAllTimersAsync());

    expect(screen.getByText("Unable to show this view")).toBeTruthy();
    expect(window.reportError).toHaveBeenCalledTimes(1);

    failing = false;
    fireEvent.click(screen.getByText("Try again"));
    await act(() => vi.runAllTimersAsync());

    expect(screen.getByText("view loaded")).toBeTruthy();
  });
});
