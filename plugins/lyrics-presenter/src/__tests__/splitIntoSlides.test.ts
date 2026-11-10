import { describe, expect, it } from "vitest";

import { splitIntoSlides } from "../format/splitIntoSlides";

const lines = (...l: string[]) => l.join("\n");

describe("splitIntoSlides", () => {
  it("regroups each section, replacing the breaks already there", () => {
    const song = lines(
      "[Verse 1]",
      "One",
      "-",
      "Two",
      "Three",
      "Four",
      "Five",
      "",
      "[Chorus]",
      "Six",
      "Seven",
      "Eight",
    );
    expect(splitIntoSlides(song, 2)).toBe(
      lines(
        "[Verse 1]",
        "One",
        "Two",
        "-",
        "Three",
        "Four",
        "-",
        "Five",
        "",
        "[Chorus]",
        "Six",
        "Seven",
        "-",
        "Eight",
      ),
    );
  });

  it("keeps a chord line with the lyric beneath it, and does not count it", () => {
    const song = lines(
      "[Verse]",
      ".G",
      "Amazing grace",
      ".C",
      "How sweet the sound",
      ".G",
      "That saved a wretch",
    );
    expect(splitIntoSlides(song, 2)).toBe(
      lines(
        "[Verse]",
        ".G",
        "Amazing grace",
        ".C",
        "How sweet the sound",
        "-",
        ".G",
        "That saved a wretch",
      ),
    );
  });

  it("counts ChordPro lines as lyrics and chord-only lines as nothing", () => {
    const song = lines(
      "[Verse]",
      "[G] [C] [D]",
      "Amazing [G]grace",
      "How [C]sweet",
      "[D]That saved",
    );
    expect(splitIntoSlides(song, 2)).toBe(
      lines(
        "[Verse]",
        "[G] [C] [D]",
        "Amazing [G]grace",
        "How [C]sweet",
        "-",
        "[D]That saved",
      ),
    );
  });

  it("does not take a lone chord for a heading", () => {
    expect(splitIntoSlides(lines("[G]", "One", "Two"), 1)).toBe(
      lines("[G]", "One", "-", "Two"),
    );
  });
});
