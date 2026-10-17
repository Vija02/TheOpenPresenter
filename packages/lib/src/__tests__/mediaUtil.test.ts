import { describe, expect, it } from "vitest";

import { mediaDataPath, normalizeMediaUrl } from "../mediaUtil";

const NAME = "media_01kn2cpae5fk7adpbteae5tgyg.mp4";

describe("mediaDataPath", () => {
  it("is relative, so it loads from whichever server serves the page", () => {
    expect(mediaDataPath(NAME)).toBe(`/media/data/${NAME}`);
  });
});

describe("normalizeMediaUrl", () => {
  it("drops the host from links to our own media", () => {
    expect(normalizeMediaUrl(`http://localhost:5678/media/data/${NAME}`)).toBe(
      `/media/data/${NAME}`,
    );
    expect(
      normalizeMediaUrl(`https://theopenpresenter.com/media/processed/480/${NAME}`),
    ).toBe(`/media/processed/480/${NAME}`);
    expect(normalizeMediaUrl(`http://192.168.1.20:5678/media/data/${NAME}?v=1`)).toBe(
      `/media/data/${NAME}?v=1`,
    );
  });

  it("leaves everything else alone", () => {
    for (const url of [
      `/media/data/${NAME}`,
      "https://www.youtube.com/watch?v=abc",
      "https://example.com/media/data/movie.mp4",
      "https://example.com/other/media/data/" + NAME,
    ]) {
      expect(normalizeMediaUrl(url)).toBe(url);
    }
  });
});
