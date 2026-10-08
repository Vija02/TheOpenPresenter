import { isSpanArray } from "@repo/layout";
import { describe, expect, it } from "vitest";

import { backgroundFromMedia } from "../backgrounds";
import { processSong } from "../songHelpers";
import { BACKGROUND_ELEMENT_ID, HEADING_ROLE } from "../template/ids";
import {
  DEFAULT_SCENE_BACKGROUND,
  composeLayout,
  fullSongLayout,
  sceneBackground,
  sceneTemplate,
  songTemplate,
  textLayout,
} from "../template/layout";
import { defaultLyricsTemplate, lyricsDoc } from "../template/presets";
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

  it("falls back from the song, to the scene, to the default", () => {
    expect(sceneTemplate({ template: null })).toBe(defaultLyricsTemplate());
    expect(songTemplate({ template: null }, { template })).toBe(template);
    const own = lyricsDoc({ style: { valign: "top" } });
    expect(songTemplate({ template: own }, { template })).toBe(own);
    expect(sceneBackground({ background: null })).toBeNull();
    // Never set, as on new and seeded scenes
    expect(sceneBackground({} as Parameters<typeof sceneBackground>[0])).toBe(
      DEFAULT_SCENE_BACKGROUND,
    );
  });
});
