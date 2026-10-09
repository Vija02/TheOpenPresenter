import { isSpanArray } from "@repo/layout";
import { describe, expect, it } from "vitest";

import { backgroundFromMedia } from "../backgrounds";
import { processSong } from "../songHelpers";
import {
  BACKGROUND_ELEMENT_ID,
  CHORD_ROLE,
  HEADING_ROLE,
  LIVE_CHORD_ROLE,
  LIVE_HEADING_ROLE,
  LIVE_ROLE,
  LYRICS_BODY_ELEMENT_ID,
} from "../template/ids";
import {
  composeLayout,
  fullSongLayout,
  textLayout,
  withLiveRole,
} from "../template/layout";
import { lyricsDoc } from "../template/presets";
import { fullSongFrame, sectionsFrame, slideAt } from "../template/toFrame";

const content = "[Verse]\na\nb\n-\nc\n[Chorus]\nd";
const groups = processSong(content);
const info = { title: "Song", author: null };

describe("frames", () => {
  it("finds a slide by flat index", () => {
    expect(slideAt(groups, 0)).toEqual({ heading: "Verse", lines: ["a", "b"] });
    expect(slideAt(groups, 1)).toEqual({ heading: "Verse", lines: ["c"] });
    expect(slideAt(groups, 2)).toEqual({ heading: "Chorus", lines: ["d"] });
    expect(slideAt(groups, 3)).toBeNull();
  });

  it("gives a slide its lines, section and song details", () => {
    expect(sectionsFrame(info, groups, 0)).toEqual({
      title: "Song",
      author: "",
      lyrics: [{ text: "a\nb", role: null }],
      section: "Verse",
    });
  });

  it("leads each block of a full song with its heading", () => {
    const frame = fullSongFrame(info, groups);
    expect(isSpanArray(frame.lyrics)).toBe(true);
    expect(frame.lyrics).toEqual([
      { text: "Verse", role: HEADING_ROLE },
      { text: "\na\nb\nc", role: null },
      { text: "\n\n", role: null },
      { text: "Chorus", role: HEADING_ROLE },
      { text: "\nd", role: null },
    ]);
  });
});

describe("chords", () => {
  const chord = (text: string, name: string) => ({
    text,
    role: null,
    above: { text: name, role: CHORD_ROLE },
  });

  it("are dropped unless asked for", () => {
    const plain = processSong("[Verse]\nAmazing [G]grace\n[G] [C]");
    expect(sectionsFrame(info, plain, 0).lyrics).toEqual([
      { text: "Amazing grace", role: null },
    ]);
  });

  it("sit over the text after them, chord-only lines included", () => {
    const withChords = processSong(
      "[Verse]\nAmazing [G]grace how [C]sweet\n[D][Em]",
      null,
      { chords: true },
    );
    expect(sectionsFrame(info, withChords, 0).lyrics).toEqual([
      { text: "Amazing ", role: null },
      chord("grace how ", "G"),
      chord("sweet", "C"),
      { text: "\n", role: null },
      chord("", "D"),
      chord("", "Em"),
    ]);
  });

  it("keep the same slides, so offsets line up", () => {
    const song = "[Verse]\n[G]a\n-\n[C] [D]\nb\n[Chorus]\nc";
    expect(
      processSong(song, null, { chords: true }).map((g) => g.slides.length),
    ).toEqual(processSong(song).map((g) => g.slides.length));
  });
});

describe("highlighting the live slide", () => {
  it("picks out that slide's lines and its section's heading", () => {
    expect(fullSongFrame(info, groups, 1).lyrics).toEqual([
      { text: "Verse", role: LIVE_HEADING_ROLE },
      { text: "\na\nb\n", role: null },
      { text: "c", role: LIVE_ROLE },
      { text: "\n\n", role: null },
      { text: "Chorus", role: HEADING_ROLE },
      { text: "\nd", role: null },
    ]);
  });

  it("and its chords", () => {
    const song = processSong("[Verse]\n[G]a\n-\n[C]b", null, { chords: true });
    expect(fullSongFrame(info, song, 1).lyrics).toEqual([
      { text: "Verse", role: LIVE_HEADING_ROLE },
      { text: "\n", role: null },
      { text: "a", role: null, above: { text: "G", role: CHORD_ROLE } },
      { text: "\n", role: null },
      {
        text: "b",
        role: LIVE_ROLE,
        above: { text: "C", role: LIVE_CHORD_ROLE },
      },
    ]);
  });

  it("styles it, unless the template already does", () => {
    const body = (doc: ReturnType<typeof lyricsDoc>) =>
      doc.elements.find((e) => e.id === LYRICS_BODY_ELEMENT_ID);
    const styled = body(withLiveRole(lyricsDoc()));
    expect(
      styled?.type === "text" && styled.spanRoles?.[LIVE_ROLE],
    ).toBeTruthy();

    const own = lyricsDoc();
    const ownBody = body(own);
    if (ownBody?.type === "text") {
      ownBody.spanRoles = {
        ...ownBody.spanRoles,
        [LIVE_ROLE]: { color: "#00FF00" },
      };
    }
    const kept = body(withLiveRole(own));
    expect(kept?.type === "text" && kept.spanRoles?.[LIVE_ROLE]).toEqual({
      color: "#00FF00",
    });
  });
});

describe("layouts", () => {
  const template = lyricsDoc({ section: { x: 0, y: 90, w: 100, h: 10 } });
  const picture = backgroundFromMedia({
    type: "image",
    src: "https://example.com/a.jpg",
  });

  it("puts the background under the text, for pictures of the slide", () => {
    const composed = composeLayout(template, picture);
    expect(composed.elements[0]?.id).toBe(BACKGROUND_ELEMENT_ID);
    expect(composed.elements.slice(1)).toEqual(template.elements);
    expect(composeLayout(template, null)).toEqual(template);
  });

  it("never draws a background element that slipped into a template", () => {
    expect(textLayout(composeLayout(template, picture))).toEqual(template);
    expect(textLayout(template)).toBe(template);
  });

  it("flows only the lyrics into columns for full song", () => {
    const fits = fullSongLayout(template).elements.map(
      (e) => e.type === "text" && e.fit,
    );
    expect(fits).toEqual(["columns", "fitNoWrap"]);
  });
});
