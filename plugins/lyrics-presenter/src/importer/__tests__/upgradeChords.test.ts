import { describe, expect, it } from "vitest";

import {
  contentNeedsChordUpgrade,
  upgradeMwlChordCodes,
} from "../upgradeChords";

/**
 * A song imported before we decoded chords, taken from a real project.
 * "Washed", MyWorshipList id 1935, key B.
 */
const WASHED = [
  "[Verse 1]",
  ". x00/x04 x05",
  "I’m clean",
  ".x07 x09m x00/x04 x05",
  "Sin was stained on me",
].join("\n");

describe("contentNeedsChordUpgrade", () => {
  it("spots leftover placeholders", () => {
    expect(contentNeedsChordUpgrade(WASHED)).toBe(true);
  });

  it("leaves a song that already has real chords alone", () => {
    expect(contentNeedsChordUpgrade("[G]Amazing [C]grace")).toBe(false);
  });
});

describe("upgradeMwlChordCodes", () => {
  it("decodes the placeholders against the key", () => {
    expect(upgradeMwlChordCodes(WASHED, "B")).toBe(
      [
        "[Verse 1]",
        ". B/D# E",
        "I’m clean",
        ".F# G#m B/D# E",
        "Sin was stained on me",
      ].join("\n"),
    );
  });

  it("keeps the chords on their own line", () => {
    // The old importer collapsed whitespace before storing, so the columns
    // saying which syllable each chord sat on are gone. Inlining them would
    // invent positions the sheet never had.
    const upgraded = upgradeMwlChordCodes(WASHED, "B");

    expect(upgraded.split("\n").filter((line) => line.startsWith("."))).toEqual([
      ". B/D# E",
      ".F# G#m B/D# E",
    ]);
  });

  it("never touches the lyrics", () => {
    const upgraded = upgradeMwlChordCodes(WASHED, "B");

    expect(upgraded).toContain("I’m clean");
    expect(upgraded).toContain("Sin was stained on me");
  });

  it("does nothing without a key to decode against", () => {
    expect(upgradeMwlChordCodes(WASHED, null)).toBe(WASHED);
  });

  it("does nothing to a song that is already upgraded", () => {
    const modern = "[Verse 1]\n[G]Amazing [C]grace";

    expect(upgradeMwlChordCodes(modern, "G")).toBe(modern);
  });
});
