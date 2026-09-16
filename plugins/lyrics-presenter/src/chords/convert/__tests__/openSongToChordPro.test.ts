import { describe, expect, it } from "vitest";

import { detectAlignment } from "../../alignment/detectAlignment";
import { stripInlineChords } from "../../chordpro";
import { openSongToChordPro } from "../openSongToChordPro";

describe("openSongToChordPro", () => {
  it("moves a monospace chord line inline", () => {
    const content = [".G                 C", "Amazing grace how sweet"].join(
      "\n",
    );

    expect(openSongToChordPro(content)).toBe("[G]Amazing grace how [C]sweet");
  });

  it("keeps a chord the author put mid-word", () => {
    const content = [".G     C", "Amazing grace"].join("\n");

    expect(openSongToChordPro(content)).toBe("[G]Amazin[C]g grace");
  });

  it("never changes the lyrics", () => {
    const content = [".G     C    D", "Amazing grace how sweet the sound"].join(
      "\n",
    );

    expect(stripInlineChords(openSongToChordPro(content))).toBe(
      "Amazing grace how sweet the sound",
    );
  });

  it("keeps a chord line that has no lyric under it as an OpenSong line", () => {
    const content = [".G C D", "", "Something"].join("\n");

    expect(openSongToChordPro(content).split("\n")[0]).toBe(".G C D");
  });

  it("leaves a bar-line chord line alone", () => {
    const content = [".| G /// | Em / D / |", "", "Something"].join("\n");

    expect(openSongToChordPro(content).split("\n")[0]).toBe(
      ".| G /// | Em / D / |",
    );
  });

  it("leaves section headings and slide breaks alone", () => {
    const content = ["[Verse 1]", ".G", "Hello", "-", "[Chorus]"].join("\n");

    expect(openSongToChordPro(content).split("\n")).toEqual([
      "[Verse 1]",
      "[G]Hello",
      "-",
      "[Chorus]",
    ]);
  });

  it("reads chord columns as monospace character positions", () => {
    // Column 30 means character 30, however wide those characters render.
    const content = [
      ".G                             C",
      "Amazing grace how sweet the sound",
    ].join("\n");
    const result = openSongToChordPro(content);

    expect(stripInlineChords(result)).toBe("Amazing grace how sweet the sound");
    expect(result).toContain("so[C]und");
  });
});

describe("detectAlignment", () => {
  it("calls a monospace sheet monospace", () => {
    // Chords sit directly above the word they belong to, column for column.
    const pairs = [
      { chordLine: "G        C", lyricLine: "Amazing grace how" },
      { chordLine: "D    G", lyricLine: "That saved a" },
      { chordLine: "C      D", lyricLine: "Wretch like me now" },
      { chordLine: "G     C", lyricLine: "I once was lost" },
    ];

    expect(detectAlignment(pairs).mode).toBe("mono");
  });

  it("falls back to monospace without enough evidence", () => {
    const result = detectAlignment([{ chordLine: "G", lyricLine: "Hello" }]);

    expect(result.mode).toBe("mono");
    expect(result.confident).toBe(false);
  });

  it("reports how far chords overflow the lyric", () => {
    const result = detectAlignment([
      {
        chordLine: "G                                    C",
        lyricLine: "Short",
      },
      {
        chordLine: "D                                    G",
        lyricLine: "Also short",
      },
      {
        chordLine: "C                                    D",
        lyricLine: "Tiny",
      },
    ]);

    expect(result.overflowRatio).toBeGreaterThan(0.4);
  });
});
