import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SETTLED, evaluateSlide } from "../evaluate";
import {
  normalizeAnimation,
  normalizeSlide,
  parseDuration,
} from "../normalize";
import {
  compileTimeline,
  groupForClickCount,
  navigationTiming,
} from "../timeline";
import { transitionPlayback } from "../transitions";
import type { OfficeSlide } from "../types";

// A real deck as the slideshow service returned it (text stripped)
const firstDeck = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/firstDeck.json"), "utf8"),
) as {
  w: number;
  h: number;
  slides: Record<"1" | "2" | "3" | "7" | "10", Record<string, any>>;
};
const size = { width: firstDeck.w, height: firstDeck.h };
const slide = (n: keyof typeof firstDeck.slides) =>
  normalizeSlide(firstDeck.slides[n]);

describe("normalizeSlide", () => {
  it("reads shapes, sprites and animations", () => {
    const s = slide("2");
    expect(s.shapes).toHaveLength(14);
    expect(s.shapes[0]).toMatchObject({
      id: 3,
      x: 0,
      y: 0,
      region: { img: expect.stringMatching(/^S/), x: 0, y: 0 },
    });
    expect(s.animations).toHaveLength(11);
    expect(s.animations[0]).toMatchObject({
      shapeId: 8,
      kind: "entrance",
      effectId: 42,
      start: "click",
      duration: { type: "timed", ms: 1000 },
      childDelayMs: -1,
    });
    expect(s.background).toEqual({ type: "color", color: "#ffffff" });
  });

  it("blends a translucent background onto white", () => {
    expect(slide("1").background).toEqual({
      type: "color",
      color: "#fcebe2",
    });
  });

  it("decodes enums", () => {
    const anim = normalizeAnimation({
      sp: 4,
      effectType: 1,
      effectId: 10,
      dir: 0,
      timing: { st: 2, off: 250, spd: "clk" },
      hideAfter: 2,
      repeat: { type: 0, count: 2 },
      rotAng: 360000,
      smSt: 50,
      smEnd: 0,
    });
    expect(anim).toMatchObject({
      kind: "exit",
      start: "after",
      delayMs: 250,
      duration: { type: "untilClick" },
      hideAfter: "nextClick",
      repeat: 2,
      rotateDeg: 360,
      smoothStart: 0.5,
    });
  });

  it("parses durations like the viewer", () => {
    expect(parseDuration("def")).toEqual({ type: "timed", ms: 2000 });
    expect(parseDuration("sld")).toEqual({ type: "untilSlide" });
    expect(parseDuration("750")).toEqual({ type: "timed", ms: 750 });
  });
});

describe("compileTimeline", () => {
  it("gives every on-click animation its own group", () => {
    const timeline = compileTimeline(slide("2"));
    expect(timeline.groups).toBe(11);
    expect(timeline.autoStart).toBe(false);
    expect(navigationTiming(timeline).clickCount).toBe(11);
    expect(timeline.groupDurationsMs.slice(0, 2)).toEqual([1000, 500]);
  });

  it("plays a leading with-previous animation on entry", () => {
    // Slide 3's only animation is "with previous"
    const timeline = compileTimeline(slide("3"));
    expect(timeline.autoStart).toBe(true);
    expect(navigationTiming(timeline)).toEqual({
      clickCount: 0,
      autoplayMs: 700,
      clickDurationsMs: [],
    });
  });

  it("counts a leading delay into the automatic group", () => {
    // Slide 7: fade with previous after 1s, then two clicks
    const timing = navigationTiming(compileTimeline(slide("7")));
    expect(timing).toEqual({
      clickCount: 2,
      autoplayMs: 1700,
      clickDurationsMs: [500, 500],
    });
  });

  it("chains with/after previous inside one click", () => {
    const base = slide("10");
    const anim = base.animations[0]!;
    const s: OfficeSlide = {
      ...base,
      animations: [
        { ...anim, shapeId: 4, start: "click" },
        { ...anim, shapeId: 5, start: "with", delayMs: 100 },
        { ...anim, shapeId: 6, start: "after" },
        { ...anim, shapeId: 7, start: "after", delayMs: 1000 },
        { ...anim, shapeId: 8, start: "with" },
      ],
    };
    const timeline = compileTimeline(s);
    expect(timeline.groups).toBe(1);
    expect(timeline.items.map((i) => i.startMs)).toEqual([
      0, 100, 600, 2100, 1100,
    ]);
    expect(timeline.groupDurationsMs).toEqual([2600]);
  });

  it("maps click counts onto groups", () => {
    const timeline = compileTimeline(slide("7"));
    expect(groupForClickCount(timeline, -1)).toBe(0);
    expect(groupForClickCount(timeline, 0)).toBe(1);
    expect(groupForClickCount(timeline, 2)).toBe(3);
  });
});

describe("evaluateSlide", () => {
  // Slide 10: shape 4 flies in from the bottom on click 1
  const s = slide("10");
  const timeline = compileTimeline(s);
  const shape = s.shapes.find((x) => x.id === 4)!;

  it("keeps entrance targets hidden until their click", () => {
    const frame = evaluateSlide(s, timeline, 0, SETTLED, size);
    expect(frame.get("4")?.visible).toBe(false);
  });

  it("flies in from below the slide", () => {
    const start = evaluateSlide(s, timeline, 1, 0, size).get("4")!;
    expect(start.visible).toBe(true);
    expect(start.y).toBeCloseTo(size.height - shape.y);
    const middle = evaluateSlide(s, timeline, 1, 250, size).get("4")!;
    expect(middle.y).toBeCloseTo((size.height - shape.y) / 2);
    const done = evaluateSlide(s, timeline, 1, SETTLED, size).get("4")!;
    expect(done).toMatchObject({ visible: true, y: 0, x: 0 });
  });

  it("runs an exit as the entrance backwards", () => {
    const exit: OfficeSlide = {
      ...s,
      animations: [{ ...s.animations[0]!, kind: "exit" }],
    };
    const t = compileTimeline(exit);
    expect(evaluateSlide(exit, t, 0, SETTLED, size).get("4")?.visible).toBe(
      true,
    );
    const middle = evaluateSlide(exit, t, 1, 250, size).get("4")!;
    expect(middle.y).toBeCloseTo((size.height - shape.y) / 2);
    expect(evaluateSlide(exit, t, 1, SETTLED, size).get("4")?.visible).toBe(
      false,
    );
  });
});

describe("transitionPlayback", () => {
  it("maps PowerPoint transition types", () => {
    expect(
      transitionPlayback({ type: 20, durationMs: 900, direction: 1 }),
    ).toEqual({ kind: "push", durationMs: 900, direction: 1 });
    expect(
      transitionPlayback({ type: 23, durationMs: 500, direction: 0 }),
    ).toMatchObject({ kind: "fade", durationMs: 500 });
  });

  it("treats no transition and cut as instant", () => {
    expect(transitionPlayback(null)).toMatchObject({
      kind: "cut",
      durationMs: 0,
    });
    expect(
      transitionPlayback({ type: 0, durationMs: 700, direction: 0 }),
    ).toMatchObject({ kind: "cut", durationMs: 0 });
  });

  it("fades for 700ms where it can't draw the transition, like the viewer", () => {
    // 60 is Morph, which needs data the service only sends to its WebGL player
    expect(
      transitionPlayback({ type: 60, durationMs: 2000, direction: 0 }),
    ).toEqual({ kind: "fade", durationMs: 700, direction: 0 });
  });
});
