import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { imagePaint } from "../../schema/paint";
import { FillLayer } from "./FillLayer";

const imgEl = () => document.querySelector("img");

afterEach(() => {
  vi.useRealTimers();
});

describe("FillLayer image fill", () => {
  it("keeps the image while it loads", () => {
    render(
      <FillLayer
        fill={imagePaint("https://example.com/slide.jpg", "contain")}
        elementId="el"
      />,
    );

    expect(imgEl()).toBeTruthy();
    expect(document.querySelector("svg")).toBeNull();
  });

  it("retries then falls back to a placeholder when the media never loads", () => {
    vi.useFakeTimers();

    render(
      <FillLayer
        fill={imagePaint("https://example.com/missing.jpg", "contain")}
        elementId="el"
      />,
    );

    // Initial attempt plus three retries all fail.
    for (let i = 0; i < 4; i++) {
      expect(imgEl()).toBeTruthy();
      act(() => {
        fireEvent.error(imgEl()!);
      });
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
    }

    // The broken <img> is gone, replaced by the fallback icon.
    expect(imgEl()).toBeNull();
    expect(document.querySelector("svg")).toBeTruthy();
  });
});
