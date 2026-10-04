import { describe, expect, it } from "vitest";

import { joinAllNotes, splitAllNotes } from "../allNotes";

describe("all notes text", () => {
  it("round-trips, including empty and multi-line notes", () => {
    const notes = ["Welcome", "", "Line one\nLine two"];
    expect(splitAllNotes(joinAllNotes(notes), 3)).toEqual({
      ok: true,
      notes,
    });
  });

  it("labels each section with its slide number", () => {
    expect(joinAllNotes(["a", "b"])).toBe("--- Slide 1\na\n\n--- Slide 2\nb");
  });

  it("only needs the leading --- on a separator line", () => {
    expect(splitAllNotes("---\nfirst\n--- anything\nsecond", 2)).toEqual({
      ok: true,
      notes: ["first", "second"],
    });
  });

  it("does not treat --- inside a line as a separator", () => {
    expect(splitAllNotes("--- Slide 1\nwait---then go", 1)).toEqual({
      ok: true,
      notes: ["wait---then go"],
    });
  });

  it("rejects a separator count that doesn't match the slides", () => {
    const result = splitAllNotes("--- Slide 1\na", 2);
    expect(result.ok).toBe(false);
  });

  it("rejects text above the first separator", () => {
    const result = splitAllNotes("stray\n--- Slide 1\na", 1);
    expect(result.ok).toBe(false);
  });

  it("allows blank lines above the first separator", () => {
    expect(splitAllNotes("\n\n--- Slide 1\na", 1)).toEqual({
      ok: true,
      notes: ["a"],
    });
  });
});
