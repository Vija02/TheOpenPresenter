import { describe, expect, it } from "vitest";

import { volumeToAmplitude } from "../helper";

describe("volumeToAmplitude", () => {
  it("keeps silence and full volume as they are", () => {
    expect(volumeToAmplitude(0)).toBe(0);
    expect(volumeToAmplitude(1)).toBe(1);
  });

  it("clamps anything outside the slider's range", () => {
    expect(volumeToAmplitude(-0.5)).toBe(0);
    expect(volumeToAmplitude(1.5)).toBe(1);
  });

  // Players take amplitude, so a linear mapping leaves the top of the
  // slider sounding almost the same
  it("follows a curve, not a straight line", () => {
    expect(volumeToAmplitude(0.5)).toBeLessThan(0.2);
  });

  // Too wide a range leaves the bottom fifth inaudible on a room's speakers
  it("keeps the bottom of the slider audible", () => {
    const toDb = (v: number) => 20 * Math.log10(volumeToAmplitude(v));
    expect(toDb(0.15)).toBeGreaterThan(-31);
    expect(toDb(0.2)).toBeGreaterThan(-29);
  });

  it("gets steadily louder all the way up, with no jump near 0", () => {
    const steps = Array.from({ length: 101 }, (_, i) =>
      volumeToAmplitude(i / 100),
    );
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]!);
    }
    expect(steps[1]).toBeLessThan(0.005);
  });
});
