import { describe, expect, it } from "vitest";

import { stripInlineChords } from "../../chordpro";
import { chordProToOpenSong } from "../chordProToOpenSong";
import { openSongToChordPro } from "../openSongToChordPro";

describe("chordProToOpenSong", () => {
  it("lifts inline chords onto their own line", () => {
    expect(chordProToOpenSong("[G]Amazing [C]grace")).toBe(
      ".G       C\nAmazing grace",
    );
  });

  it("leaves chordless lines alone", () => {
    expect(chordProToOpenSong("[Verse 1]\nAmazing grace")).toBe(
      "[Verse 1]\nAmazing grace",
    );
  });

  it("round-trips back to the same chord positions", () => {
    const original = "[G]Amazing [C]grace how [D]sweet";
    const back = openSongToChordPro(chordProToOpenSong(original));

    expect(back).toBe(original);
  });

  it("never changes the words", () => {
    const original = "That [G]saved a wretch like [D]me";
    const openSong = chordProToOpenSong(original);

    expect(openSong.split("\n")[1]).toBe(stripInlineChords(original));
  });
});
