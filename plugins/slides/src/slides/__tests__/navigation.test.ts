import { describe, expect, it } from "vitest";

import type { PluginBaseData } from "../../types";
import { navigate, settledStep } from "../navigation";

// Slide 0: 2 builds. Slide 1: autoplay object, 1 build, 400ms transition.
// Slide 2: no builds.
const pluginData = {
  imports: {
    g: {
      importId: "g",
      type: "googleslides",
      fetchId: "f",
      presentationId: "p",
      html: "",
      thumbnailLinks: ["a", "b", "c"],
      slideIds: ["0", "1", "2"],
      slideClickCounts: [2, 1, 0],
      slideTransitionDurations: [0, 400, 0],
      slideClickDurations: [[100, 200], [300], []],
      slideAutoplayDurations: [0, 500, 0],
    },
  },
  slideOrder: ["g:0", "g:1", "g:2"],
} as unknown as PluginBaseData;

const settled = (slideIndex: number, clickCount: number) => ({
  slideIndex,
  clickCount,
  transitionEndsAt: 0,
  isTransitioningBackwards: false,
});

const NOW = 10_000;

describe("navigate", () => {
  it("steps through builds before leaving the slide", () => {
    const r = navigate(pluginData, settled(0, 0), "NEXT", NOW);
    expect(r).toMatchObject({
      slideIndex: 0,
      clickCount: 1,
      enteredSlide: false,
    });
    expect(r.transitionEndsAt).toBe(NOW + 100);
  });

  it("enters the next slide with transition plus autoplay as its window", () => {
    const r = navigate(pluginData, settled(0, 2), "NEXT", NOW);
    expect(r).toMatchObject({
      slideIndex: 1,
      clickCount: 0,
      enteredSlide: true,
    });
    expect(r.transitionEndsAt).toBe(NOW + 400 + 500);
  });

  it("only finishes the last step when it is still animating", () => {
    const r = navigate(
      pluginData,
      { ...settled(0, 2), transitionEndsAt: NOW + 50 },
      "NEXT",
      NOW,
    );
    expect(r).toMatchObject({
      slideIndex: 0,
      clickCount: 2,
      transitionEndsAt: 0,
    });
  });

  it("peels the autoplay object off to -1 before leaving backwards", () => {
    const r = navigate(pluginData, settled(1, 0), "PREV", NOW);
    expect(r).toMatchObject({
      slideIndex: 1,
      clickCount: -1,
      enteredSlide: false,
    });
  });

  it("goes back to the previous slide at its last build, reversing the left slide's transition", () => {
    const r = navigate(pluginData, settled(1, -1), "PREV", NOW);
    expect(r).toMatchObject({
      slideIndex: 0,
      clickCount: 2,
      enteredSlide: true,
      isTransitioningBackwards: true,
      transitionEndsAt: NOW + 400,
    });
  });

  it("NEXT during a reverse transition cancels back to the autoplay sub-step", () => {
    const r = navigate(
      pluginData,
      {
        slideIndex: 0,
        clickCount: 2,
        transitionEndsAt: NOW + 100,
        isTransitioningBackwards: true,
      },
      "NEXT",
      NOW,
    );
    expect(r).toMatchObject({
      slideIndex: 1,
      clickCount: -1,
      transitionEndsAt: 0,
    });
  });

  it("does nothing at either end", () => {
    expect(navigate(pluginData, settled(0, 0), "PREV", NOW)).toMatchObject({
      slideIndex: 0,
      clickCount: 0,
    });
    expect(navigate(pluginData, settled(2, 0), "NEXT", NOW)).toMatchObject({
      slideIndex: 2,
      clickCount: 0,
    });
  });
});

describe("settledStep", () => {
  it("follows navigate, including the -1 autoplay step", () => {
    expect(
      settledStep(pluginData, { slideIndex: 1, clickCount: 0 }, "PREV"),
    ).toEqual({
      slideIndex: 1,
      clickCount: -1,
    });
    expect(
      settledStep(pluginData, { slideIndex: 0, clickCount: 1 }, "NEXT"),
    ).toEqual({
      slideIndex: 0,
      clickCount: 2,
    });
  });

  it("is null when a press would not move", () => {
    expect(
      settledStep(pluginData, { slideIndex: 0, clickCount: 0 }, "PREV"),
    ).toBeNull();
    expect(
      settledStep(pluginData, { slideIndex: 2, clickCount: 0 }, "NEXT"),
    ).toBeNull();
  });
});
