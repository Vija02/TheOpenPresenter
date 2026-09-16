import { describe, expect, it } from "vitest";

import {
  chordsInContent,
  guessKey,
  resolveKey,
  transposeContent,
  transposeKey,
} from "../song";

const SONG = ["[Verse 1]", "[G]Amazing [C]grace", "That [D]saved"].join("\n");

describe("resolveKey", () => {
  it("prefers the key the source gave us", () => {
    // The song opens on Bm but the source says D, and the source is right.
    expect(resolveKey({ key: "D", content: "[Bm]Hello [G]world" })).toBe("D");
  });

  it("falls back to guessing when the source did not say", () => {
    expect(resolveKey({ key: null, content: SONG })).toBe("G");
    expect(resolveKey({ content: SONG })).toBe("G");
  });

  it("is null when there is nothing to go on", () => {
    expect(resolveKey({ key: null, content: "No chords here" })).toBeNull();
  });
});

describe("guessKey", () => {
  it("assumes the song opens on its tonic", () => {
    expect(guessKey(SONG)).toBe("G");
  });

  it("is null without chords", () => {
    expect(guessKey("[Verse 1]\nJust words")).toBeNull();
  });
});

describe("chordsInContent", () => {
  it("counts chords on OpenSong lines that stayed as they are", () => {
    const content = ["[Intro]", ".| D /// | Em / D / |"].join("\n");

    expect(chordsInContent(content)).toEqual(["D", "Em"]);
  });
});

describe("transposeContent", () => {
  it("transposes an OpenSong chord line and keeps its bars", () => {
    const content = ["[Intro]", ".| D /// | Em / D / |"].join("\n");

    expect(transposeContent(content, 2, "D")).toBe(
      ["[Intro]", ".| E /// | F#m / E / |"].join("\n"),
    );
  });
});

describe("transposeKey", () => {
  it("moves the key by the same interval as the chords", () => {
    expect(transposeKey("G", 2)).toBe("A");
    expect(transposeKey("A", -2)).toBe("G");
  });

  it("wraps around the octave", () => {
    expect(transposeKey("B", 1)).toBe("C");
  });

  it("spells the destination key the way musicians write it", () => {
    expect(transposeKey("G", 1)).toBe("Ab");
    expect(transposeKey("C", 2)).toBe("D");
  });

  it("is null when the key is unknown", () => {
    expect(transposeKey(null, 2)).toBeNull();
    expect(transposeKey(undefined, 2)).toBeNull();
  });
});
