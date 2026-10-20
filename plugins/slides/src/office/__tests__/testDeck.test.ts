import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SETTLED, evaluateSlide } from "../evaluate";
import { mediaPlayback } from "../media";
import { morphEase, morphLayers } from "../morph";
import { normalizeSlide } from "../normalize";
import { compileTimeline } from "../timeline";
import { transitionPlayback } from "../transitions";

// tools/office/make_test_deck.py, as the slideshow service returned it.
// Keys are the slide numbers in the deck's titles.
const testDeck = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/testDeck.json"), "utf8"),
) as { w: number; h: number; slides: Record<string, Record<string, any>> };
const size = { width: testDeck.w, height: testDeck.h };
const slide = (n: number) => normalizeSlide(testDeck.slides[String(n)]!);

describe("test deck capture", () => {
  it("transitions: push from bottom moves up, wipe down, cover from right moves left", () => {
    expect(transitionPlayback(slide(4).transition)).toEqual({
      kind: "push",
      durationMs: 750,
      direction: 1,
    });
    expect(transitionPlayback(slide(5).transition)).toMatchObject({
      kind: "wipe",
      direction: 3,
    });
    expect(transitionPlayback(slide(7).transition)).toMatchObject({
      kind: "cover",
      direction: 0,
    });
    expect(transitionPlayback(slide(12).transition)).toMatchObject({
      kind: "morph",
      durationMs: 2000,
    });
  });

  it("reads auto-advance and hidden slides", () => {
    expect(slide(13).advance).toEqual({ onClick: true, afterMs: 3000 });
    expect(slide(27).hidden).toBe(true);
  });

  it("builds letter by letter from pieces, 50ms apart", () => {
    const s = slide(18);
    const letters = s.shapes.find((shape) => shape.id === 5)!;
    expect(letters.region).toBeNull();
    expect(letters.children).toHaveLength(14);

    const timeline = compileTimeline(s);
    expect(timeline.items.slice(0, 3).map((i) => i.startMs)).toEqual([
      50, 100, 150,
    ]);
    const frame = evaluateSlide(s, timeline, 1, 120, size);
    expect(frame.get("5:0")?.visible).toBe(true);
    expect(frame.get("5:1")?.visible).toBe(true);
    // Not started yet: still waiting offstage
    expect(frame.get("5:5")?.visible).toBe(false);
  });

  it("fades the pre-rendered colour in for Change Fill Colour", () => {
    const s = slide(19);
    const fill = s.animations[4]!;
    expect(fill.emphasisSprite?.region.img).toBeTruthy();
    const frame = evaluateSlide(s, compileTimeline(s), 5, 1000, size);
    expect(frame.get(String(fill.shapeId))?.overlay?.alpha).toBeCloseTo(0.5);
  });

  it("moves along a motion path in slide pixels", () => {
    const s = slide(22);
    const end = evaluateSlide(s, compileTimeline(s), 1, SETTLED, size).get(
      String(s.animations[0]!.shapeId),
    );
    expect(end).toMatchObject({ x: 768, y: 216 });
  });

  it("counts repeats as extra plays", () => {
    // Spin repeated 3 times arrives as count 2
    const timeline = compileTimeline(slide(23));
    expect(timeline.groupDurationsMs).toEqual([3000, 2000]);
  });

  it("keeps trigger sequences apart from the clicks", () => {
    const s = slide(24);
    expect(compileTimeline(s).groups).toBe(0);
    expect(s.triggers).toEqual([
      { id: "1", animations: [expect.objectContaining({ shapeId: 5 })] },
    ]);
  });

  it("plays the video on the click PowerPoint gave it", () => {
    const s = slide(25);
    const video = s.shapes.find((shape) => shape.media)!;
    expect(video.media).toMatchObject({
      id: "3577289324.mp4.media",
      contentType: "video/mp4",
      durationMs: 6000,
      volume: 0.8,
      autoPlay: false,
    });
    expect(s.animations[0]).toMatchObject({ kind: "media", shapeId: video.id });

    const timeline = compileTimeline(s);
    expect(mediaPlayback(s, timeline, 0, 500).size).toBe(0);
    expect(mediaPlayback(s, timeline, 1, 1500).get(video.id)).toBe(1500);
    expect(mediaPlayback(s, timeline, 1, 7000).size).toBe(0);
    // Landing on the step cold shows the poster, not a video at a guess
    expect(mediaPlayback(s, timeline, 1, SETTLED).size).toBe(0);
  });

  it("morphs matched objects and fades the rest", () => {
    const pairs = slide(12).transition!.morph!;
    expect(pairs).toHaveLength(6);
    expect(pairs[0]!.background).toBe(true);
    // Slide 11's title letters only exist before
    expect(pairs[2]).toMatchObject({
      from: { shapes: [{ id: 4, pieces: expect.any(Array) }] },
      to: null,
    });
    expect(pairs[2]!.from!.shapes[0]!.pieces).toHaveLength(30);

    // The circle: small on the left to big on the right
    const circle = pairs[4]!;
    expect(circle.from).toMatchObject({ cx: 252, w: 216 });
    expect(circle.to).toMatchObject({ cx: 1404, w: 504 });

    const layers = morphLayers(pairs, 0.5);
    const k = morphEase(0.5);
    const moving = layers.filter(
      (l) => l.frame === circle.from || l.frame === circle.to,
    );
    expect(moving).toHaveLength(2);
    expect(moving[0]!.box.cx).toBeCloseTo(252 + (1404 - 252) * k);
    // Old look solid underneath until halfway, new look fading in on top
    expect(moving.map((l) => l.opacity)).toEqual([1, 0.5]);
    const leaving = layers.find((l) => l.frame === pairs[2]!.from)!;
    expect(leaving.box).toBe(pairs[2]!.from);
  });
});
