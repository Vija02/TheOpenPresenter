// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LAND_SETTLE_MS, useIframeSync } from "../useIframeSync";

const handle = () => ({
  next: vi.fn(() => null),
  prev: vi.fn(() => null),
  goToSlide: vi.fn(),
  getDocument: vi.fn(() => null),
});

const sync = (
  loaded: boolean,
  slide: number,
  clicks: number,
  ref = { current: handle() },
) =>
  renderHook(
    ({ loaded }) =>
      useIframeSync({
        ref,
        loaded,
        targetSlideIndex: slide,
        targetClickCount: clicks,
        targetFlatPosition: slide < 0 ? -1 : slide + clicks,
        transitionEndsAt: 0,
        lastClickTimestamp: 0,
      }),
    { initialProps: { loaded } },
  );

describe("useIframeSync landing", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("lands once the first jump and its steps have played out", () => {
    const ref = { current: handle() };
    const { result, rerender } = sync(false, 3, 2, ref);
    expect(result.current.landed).toBe(false);

    rerender({ loaded: true });
    expect(ref.current.goToSlide).toHaveBeenCalledWith(3);
    expect(result.current.landed).toBe(false);

    // Two build steps, 50 ms apart, then time for the last to animate
    act(() => vi.advanceTimersByTime(150 + LAND_SETTLE_MS - 1));
    expect(ref.current.next).toHaveBeenCalledTimes(2);
    expect(result.current.landed).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.landed).toBe(true);
  });

  it("lands at once when its deck isn't the one showing", () => {
    const { result } = sync(true, -1, 0);
    expect(result.current.landed).toBe(true);
  });
});
