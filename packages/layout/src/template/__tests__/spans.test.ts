import { describe, expect, it } from "vitest";

import { compactSpans, isSpansEmpty, span } from "../spans";

const chord = (text: string, chordName: string) => ({
  ...span(text),
  above: { text: chordName, role: "chord" },
});

describe("compactSpans", () => {
  it("never merges into or out of an annotated span", () => {
    expect(
      compactSpans([span("Amazing "), chord("grace ", "G"), span("how")]),
    ).toEqual([span("Amazing "), chord("grace ", "G"), span("how")]);
  });

  it("keeps an annotation with no text under it", () => {
    expect(compactSpans([span("me"), chord("", "D")])).toEqual([
      span("me"),
      chord("", "D"),
    ]);
  });
});

describe("isSpansEmpty", () => {
  it("counts an annotation as content", () => {
    expect(isSpansEmpty([chord("", "G")])).toBe(false);
    expect(isSpansEmpty([span("  ")])).toBe(true);
  });
});
