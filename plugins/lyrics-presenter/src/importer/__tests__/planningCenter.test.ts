import { describe, expect, it } from "vitest";

import { convertPcoLyrics } from "../planningCenter";

/**
 * Planning Center serves an arrangement's chord chart, which churches write in
 * one of two ways. Both fixtures are the shape the fake PCO server returns.
 */

/** Chords on their own line, positioned by whitespace. */
const POSITIONAL = `VERSE 1
D          G      D
Amazing grace how sweet the sound
             A
That saved a wretch like me

CHORUS
My chains are gone
I've been set free`;

/** Already ChordPro. */
const INLINE = `[Verse 1]
[G]O Lord my [C]God
When I in [D]awesome wonder

[Chorus]
Then sings my soul`;

describe("convertPcoLyrics", () => {
  it("moves a positional chord chart inline", () => {
    expect(convertPcoLyrics(POSITIONAL).split("\n")).toEqual([
      "[VERSE 1]",
      "[D]Amazing gra[G]ce how [D]sweet the sound",
      "That saved a [A]wretch like me",
      "[CHORUS]",
      "My chains are gone",
      "I've been set free",
    ]);
  });

  it("keeps a chart that is already ChordPro", () => {
    expect(convertPcoLyrics(INLINE).split("\n")).toEqual([
      "[Verse 1]",
      "[G]O Lord my [C]God",
      "When I in [D]awesome wonder",
      "[Chorus]",
      "Then sings my soul",
    ]);
  });

  it("never changes the lyrics", () => {
    const lyrics = convertPcoLyrics(POSITIONAL).replace(/\[[^\]]*\]/g, "");

    expect(lyrics).toContain("Amazing grace how sweet the sound");
    expect(lyrics).toContain("That saved a wretch like me");
  });

  it("reads a section heading as a heading, not as chords", () => {
    // "D" alone is a chord, but "VERSE 1" is a heading even though it has no
    // brackets, and "A" on its own line above a lyric is a chord row.
    const content = convertPcoLyrics(POSITIONAL);

    expect(content).toContain("[VERSE 1]");
    expect(content).toContain("[CHORUS]");
  });

  it("separates slides within a section on a blank line", () => {
    const content = `VERSE 1
Amazing grace

That saved a wretch`;

    expect(convertPcoLyrics(content).split("\n")).toEqual([
      "[VERSE 1]",
      "Amazing grace",
      "-",
      "That saved a wretch",
    ]);
  });

  it("gives a chart with no headings one to live under", () => {
    expect(convertPcoLyrics("Amazing grace").split("\n")).toEqual([
      "[Unknown]",
      "Amazing grace",
    ]);
  });

  it("drops a chord line with no lyric under it", () => {
    // An instrumental row at the end of a section has nothing to attach to.
    const content = `VERSE 1
D          G
Amazing grace how`;

    expect(convertPcoLyrics(content)).toContain("Amazing gra");
  });

  it("handles an empty chart", () => {
    expect(convertPcoLyrics("")).toBe("");
  });
});
