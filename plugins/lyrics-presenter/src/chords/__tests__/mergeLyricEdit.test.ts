import { describe, expect, it } from "vitest";

import { hasInlineChords, stripInlineChords } from "../chordpro";
import {
  isChordOnlyLine,
  mergeLyricEdit,
  toLyricsOnly,
} from "../mergeLyricEdit";

const SONG = [
  "[Verse 1]",
  "[G]Amazing [C]grace how [D]sweet the sound",
  "That [G]saved a wretch like [D]me",
].join("\n");

describe("toLyricsOnly", () => {
  it("removes inline chords", () => {
    expect(toLyricsOnly(SONG)).toBe(
      [
        "[Verse 1]",
        "Amazing grace how sweet the sound",
        "That saved a wretch like me",
      ].join("\n"),
    );
  });

  it("drops chord-only lines", () => {
    expect(toLyricsOnly("[G] [C]\nHello")).toBe("Hello");
  });

  it("drops OpenSong chord lines", () => {
    expect(toLyricsOnly(".| D /// | Em / D / |\nHello")).toBe("Hello");
  });

  it("keeps section headings", () => {
    expect(toLyricsOnly("[Chorus]")).toBe("[Chorus]");
  });
});

describe("isChordOnlyLine", () => {
  it("is true for a bare chord run", () => {
    expect(isChordOnlyLine("[G] [C] [D]")).toBe(true);
  });

  it("is true for an OpenSong chord line", () => {
    expect(isChordOnlyLine(".| D /// | Em / D / |")).toBe(true);
  });

  it("is false for a heading or a lyric", () => {
    expect(isChordOnlyLine("[Verse 1]")).toBe(false);
    expect(isChordOnlyLine("[G]Amazing grace")).toBe(false);
  });
});

describe("mergeLyricEdit", () => {
  it("is a no-op when nothing changed", () => {
    expect(mergeLyricEdit(SONG, toLyricsOnly(SONG))).toBe(SONG);
  });

  it("keeps chords when a later word is edited", () => {
    const edited = toLyricsOnly(SONG).replace("wretch", "soul");
    const merged = mergeLyricEdit(SONG, edited);

    expect(stripInlineChords(merged.split("\n")[2]!)).toBe(
      "That saved a soul like me",
    );
    expect(merged).toContain("[G]saved");
    expect(merged).toContain("[D]me");
  });

  it("shifts chords after an insertion at the start of a line", () => {
    const edited = toLyricsOnly(SONG).replace(
      "Amazing grace",
      "Oh Amazing grace",
    );
    const merged = mergeLyricEdit(SONG, edited);

    expect(merged.split("\n")[1]).toBe(
      "[G]Oh Amazing [C]grace how [D]sweet the sound",
    );
  });

  it("keeps chord-only lines that the user never sees", () => {
    const withIntro = `[Intro]\n[G] [C]\n${SONG}`;
    const merged = mergeLyricEdit(withIntro, toLyricsOnly(withIntro));
    expect(merged).toContain("[G] [C]");
  });

  it("keeps an OpenSong intro line that the user never sees", () => {
    const withIntro = `[Intro]\n.| D /// | Em / D / |\n${SONG}`;
    const merged = mergeLyricEdit(withIntro, toLyricsOnly(withIntro));

    expect(merged).toContain(".| D /// | Em / D / |");
  });

  it("drops interior chords when the whole line is rewritten, but keeps the opening one", () => {
    const edited = toLyricsOnly(SONG)
      .split("\n")
      .map((line, i) => (i === 1 ? "Completely different words here" : line))
      .join("\n");
    const merged = mergeLyricEdit(SONG, edited);

    // The chord the line starts on still applies; the ones anchored to deleted
    // words do not.
    expect(merged.split("\n")[1]).toBe("[G]Completely different words here");
    // The other line is untouched.
    expect(merged.split("\n")[2]).toBe("That [G]saved a wretch like [D]me");
  });

  it("handles a deleted line", () => {
    const edited = toLyricsOnly(SONG).split("\n").slice(0, 2).join("\n");
    const merged = mergeLyricEdit(SONG, edited);

    expect(merged.split("\n")).toHaveLength(2);
    expect(merged).toContain("[G]Amazing");
  });

  it("handles an appended line", () => {
    const edited = `${toLyricsOnly(SONG)}\nA brand new line`;
    const merged = mergeLyricEdit(SONG, edited);

    expect(merged.split("\n")[3]).toBe("A brand new line");
    expect(merged).toContain("[G]Amazing");
  });

  it("keeps every line's own chords when a line is inserted above them", () => {
    // Pressing Enter at the end of the heading used to shift every line onto
    // its neighbour's chords, leaving a stray chord on the new blank line.
    const lyrics = toLyricsOnly(SONG).split("\n");
    const edited = [lyrics[0]!, "", lyrics[1]!, lyrics[2]!].join("\n");

    expect(mergeLyricEdit(SONG, edited).split("\n")).toEqual([
      "[Verse 1]",
      "",
      "[G]Amazing [C]grace how [D]sweet the sound",
      "That [G]saved a wretch like [D]me",
    ]);
  });

  it("keeps the chords below a line inserted in the middle", () => {
    const lyrics = toLyricsOnly(SONG).split("\n");
    const edited = [lyrics[0]!, lyrics[1]!, "a new line", lyrics[2]!].join(
      "\n",
    );

    expect(mergeLyricEdit(SONG, edited).split("\n")).toEqual([
      "[Verse 1]",
      "[G]Amazing [C]grace how [D]sweet the sound",
      "a new line",
      "That [G]saved a wretch like [D]me",
    ]);
  });

  it("keeps the remaining line's chords when a line above it is deleted", () => {
    const lyrics = toLyricsOnly(SONG).split("\n");
    const edited = [lyrics[0]!, lyrics[2]!].join("\n");

    expect(mergeLyricEdit(SONG, edited).split("\n")).toEqual([
      "[Verse 1]",
      "That [G]saved a wretch like [D]me",
    ]);
  });

  it("splits a line without moving chords onto the wrong half", () => {
    const lyrics = toLyricsOnly(SONG).split("\n");
    const edited = [
      lyrics[0]!,
      "Amazing grace",
      "how sweet the sound",
      lyrics[2]!,
    ].join("\n");
    const merged = mergeLyricEdit(SONG, edited).split("\n");

    expect(merged[1]).toBe("[G]Amazing [C]grace");
    expect(merged[3]).toBe("That [G]saved a wretch like [D]me");
  });

  it("keeps each half's own chords when a line is split", () => {
    // Pressing Enter mid-line used to give the first half every chord it could
    // still place and drop the rest entirely.
    const song = [
      "[Verse]",
      "Let every brea[G]th, [C]all that I [G]am, [Em]never cease to [F]worship [D]you",
    ].join("\n");
    const edited = [
      "[Verse]",
      "Let every breath, all that I am,",
      "never cease to worship you",
    ].join("\n");

    expect(mergeLyricEdit(song, edited).split("\n")).toEqual([
      "[Verse]",
      "Let every brea[G]th, [C]all that I [G]am,",
      "[Em]never cease to [F]worship [D]you",
    ]);
  });

  it("keeps the chords when a line is split more than once", () => {
    const song = [
      "[Verse]",
      "Let every brea[G]th, [C]all that I [G]am, [Em]never cease to [F]worship [D]you",
    ].join("\n");
    const edited = [
      "[Verse]",
      "Let every breath,",
      "all that I am,",
      "never cease to worship you",
    ].join("\n");

    expect(mergeLyricEdit(song, edited).split("\n")).toEqual([
      "[Verse]",
      "Let every brea[G]th,",
      "[C]all that I [G]am,",
      "[Em]never cease to [F]worship [D]you",
    ]);
  });

  it("keeps a chord at the end of a line on the half that ends up with it", () => {
    const song = ["[Verse]", "Amazing grace how sweet[G]"].join("\n");
    const edited = ["[Verse]", "Amazing grace", "how sweet"].join("\n");

    expect(mergeLyricEdit(song, edited).split("\n")).toEqual([
      "[Verse]",
      "Amazing grace",
      "how sweet[G]",
    ]);
  });

  it("never leaves a chord bracket inside a word it did not belong to", () => {
    const edited = toLyricsOnly(SONG).replace("sweet", "");
    const merged = mergeLyricEdit(SONG, edited);
    expect(hasInlineChords(merged.split("\n")[1]!)).toBe(true);
    expect(stripInlineChords(merged.split("\n")[1]!)).toBe(
      edited.split("\n")[1],
    );
  });
});
