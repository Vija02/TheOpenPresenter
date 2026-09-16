import { describe, expect, it } from "vitest";

import {
  accidentalForKey,
  formatChord,
  isChordToken,
  parseChord,
  semitonesBetweenKeys,
  transposeChordName,
} from "../chord";

describe("parseChord", () => {
  it("parses a plain major", () => {
    expect(parseChord("G")).toEqual({ root: 7, suffix: "", bass: null });
  });

  it("parses accidentals, suffixes and slash bass", () => {
    expect(parseChord("Bbm7/F")).toEqual({ root: 10, suffix: "m7", bass: 5 });
    expect(parseChord("F#sus4")).toEqual({
      root: 6,
      suffix: "sus4",
      bass: null,
    });
    expect(parseChord("Cmaj7")).toEqual({
      root: 0,
      suffix: "maj7",
      bass: null,
    });
  });

  it("rejects things that are not chords", () => {
    expect(parseChord("Verse 1")).toBeNull();
    expect(parseChord("Hello")).toBeNull();
    expect(parseChord("")).toBeNull();
    expect(isChordToken("the")).toBe(false);
  });

  it("never reads a section heading as a chord", () => {
    // Headings are square-bracketed exactly like inline chords, so a heading
    // starting with A-G must not parse: "Chorus" is not C + "horus".
    for (const heading of [
      "Chorus",
      "Bridge",
      "End",
      "Ending",
      "Coda",
      "Breakdown",
      "Channel",
      "Verse",
      "Verse 1",
      "Pre-Chorus",
      "Intro",
      "Tag",
      "Vamp",
      "Outro",
      "Refrain",
      "Hook",
      "Interlude",
      "Instrumental",
      "Unknown",
      "Misc",
      "Rap",
      "Turnaround",
    ]) {
      expect(isChordToken(heading), `"${heading}" must not be a chord`).toBe(
        false,
      );
    }
  });

  it("still parses the chord shapes real songbooks use", () => {
    for (const chord of [
      "C",
      "Am",
      "F#m7",
      "Bb",
      "D/F#",
      "Gsus4",
      "Cmaj7",
      "Db2",
      "E7sus4",
      "Dm7b5",
      "Gmaj7#11",
      "A2no3",
      "Bbm7/F",
      "C#dim",
      "Baug",
      "F+",
      "Dadd9",
      "Em11",
    ]) {
      expect(isChordToken(chord), `"${chord}" must be a chord`).toBe(true);
    }
  });
});

describe("transposeChordName", () => {
  it("moves root and bass together", () => {
    expect(transposeChordName("G/B", 2)).toBe("A/C#");
  });

  it("wraps around the octave", () => {
    expect(transposeChordName("B", 1)).toBe("C");
    expect(transposeChordName("C", -1)).toBe("B");
  });

  it("keeps the suffix untouched", () => {
    expect(transposeChordName("Am7", 3)).toBe("Cm7");
  });

  it("spells with flats when asked", () => {
    expect(transposeChordName("G", 1, "flat")).toBe("Ab");
    expect(transposeChordName("G", 1, "sharp")).toBe("G#");
  });

  it("leaves non-chords alone", () => {
    expect(transposeChordName("x00", 2)).toBe("x00");
  });
});

describe("accidentalForKey", () => {
  it("uses flats for flat keys and their relative minors", () => {
    expect(accidentalForKey("Eb")).toBe("flat");
    expect(accidentalForKey("F")).toBe("flat");
    expect(accidentalForKey("Dm")).toBe("flat");
  });

  it("uses sharps otherwise", () => {
    expect(accidentalForKey("D")).toBe("sharp");
    expect(accidentalForKey("E")).toBe("sharp");
    expect(accidentalForKey(null)).toBe("sharp");
  });
});

describe("semitonesBetweenKeys", () => {
  it("measures upward distance", () => {
    expect(semitonesBetweenKeys("G", "A")).toBe(2);
    expect(semitonesBetweenKeys("A", "G")).toBe(10);
  });
});

describe("formatChord", () => {
  it("round-trips through parse", () => {
    for (const name of ["C", "Am", "F#m7", "Bb", "D/F#"]) {
      const chord = parseChord(name);
      expect(chord).not.toBeNull();
      expect(formatChord(chord!, name.includes("b") ? "flat" : "sharp")).toBe(
        name,
      );
    }
  });
});
