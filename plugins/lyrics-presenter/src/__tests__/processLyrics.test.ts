import { describe, expect, it } from "vitest";

import { groupData, removeChords } from "../processLyrics";
import { processSong } from "../songHelpers";

describe("removeChords", () => {
  it("drops OpenSong chord lines", () => {
    expect(removeChords([".G  C", "Amazing grace"])).toEqual(["Amazing grace"]);
  });

  it("strips ChordPro chords in place", () => {
    expect(removeChords(["[G]Amazing [C]grace"])).toEqual(["Amazing grace"]);
  });

  it("removes a chord-only line entirely", () => {
    expect(removeChords(["[G] [C]", "Amazing grace"])).toEqual([
      "Amazing grace",
    ]);
  });

  it("keeps section headings", () => {
    expect(removeChords(["[Verse 1]", "[G]Hello"])).toEqual([
      "[Verse 1]",
      "Hello",
    ]);
  });
});

describe("groupData", () => {
  it("does not mistake a chord-only line for a heading", () => {
    const grouped = groupData(["[Verse 1]", "[G]", "Hello"]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]!.heading).toBe("Verse 1");
  });

  it("keeps headings that start with a note letter as headings", () => {
    // "[Chorus]" must not be read as the chord C, or the section disappears.
    const grouped = groupData([
      "[Chorus]",
      "Hello",
      "[Bridge]",
      "World",
      "[End]",
      "Bye",
    ]);

    expect(grouped.map((g) => g.heading)).toEqual(["Chorus", "Bridge", "End"]);
  });
});

describe("processSong", () => {
  it("renders ChordPro content without chords", () => {
    const grouped = processSong(
      ["[Verse 1]", "[G]Amazing [C]grace", "That [D]saved"].join("\n"),
    );

    expect(grouped[0]!.slides[0]).toEqual(["Amazing grace", "That saved"]);
  });

  it("keeps a section that is nothing but chords", () => {
    // An intro or instrumental break has no words, but it still gets a blank slide.
    const grouped = processSong(
      ["[Intro]", ".B G#m7 F# E", "[Verse 1]", "[B]I lay my life down"].join(
        "\n",
      ),
    );

    expect(grouped.map((group) => group.heading)).toEqual([
      "Intro",
      "Verse 1",
    ]);
    expect(grouped[0]!.slides).toEqual([[]]);
  });

  it("keeps the slide breaks inside a section", () => {
    const grouped = processSong(
      ["[Verse 1]", "Line one", "-", "Line two"].join("\n"),
    );

    expect(grouped[0]!.slides).toEqual([["Line one"], ["Line two"]]);
  });
});
