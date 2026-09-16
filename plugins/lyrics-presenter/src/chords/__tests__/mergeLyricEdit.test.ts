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

  it("never leaves a chord bracket inside a word it did not belong to", () => {
    const edited = toLyricsOnly(SONG).replace("sweet", "");
    const merged = mergeLyricEdit(SONG, edited);
    expect(hasInlineChords(merged.split("\n")[1]!)).toBe(true);
    expect(stripInlineChords(merged.split("\n")[1]!)).toBe(
      edited.split("\n")[1],
    );
  });
});
