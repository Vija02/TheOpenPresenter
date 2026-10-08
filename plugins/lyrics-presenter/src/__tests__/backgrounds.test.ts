import type { InternalVideo } from "@repo/video";
import { describe, expect, it } from "vitest";

import {
  type Background,
  NO_BACKGROUND,
  backgroundFromMedia,
  backgroundKey,
  resolveSceneBackgrounds,
  resolveSongBackground,
} from "../backgrounds";

const video = (id: string): InternalVideo => ({
  id,
  url: `https://example.com/${id}.mp4`,
  isInternalVideo: true,
  hlsMediaName: null,
  thumbnailMediaName: null,
  metadata: { title: id },
});

const bg = (id: string): Background =>
  backgroundFromMedia({ type: "video", video: video(id) });

const waves = bg("waves");
const clouds = bg("clouds");
const plain = backgroundFromMedia({ type: "solid", color: "#123456" });

describe("resolveSongBackground", () => {
  it("uses the song's own background", () => {
    expect(resolveSongBackground({ background: waves }, plain)?.key).toBe(
      backgroundKey(waves),
    );
  });

  it("falls back to the scene's", () => {
    expect(resolveSongBackground({ background: null }, plain)?.key).toBe(
      backgroundKey(plain),
    );
  });

  it("shows nothing when neither is set", () => {
    expect(resolveSongBackground({ background: null }, null)).toBeNull();
  });

  it("shows nothing, not the scene's, when the song says none", () => {
    expect(
      resolveSongBackground({ background: NO_BACKGROUND }, plain),
    ).toBeNull();
  });
});

describe("resolveSceneBackgrounds", () => {
  it("de-duplicates across songs, scene fallback included", () => {
    const reachable = resolveSceneBackgrounds(
      [
        { background: waves },
        { background: bg("waves") },
        { background: clouds },
        { background: null },
        { background: NO_BACKGROUND },
      ],
      plain,
    );

    expect(reachable.map((x) => x.key).sort()).toEqual(
      [waves, clouds, plain].map(backgroundKey).sort(),
    );
  });
});

describe("backgroundKey", () => {
  it("gives equal backgrounds equal keys, wherever they come from", () => {
    const fromYjs = JSON.parse(JSON.stringify(bg("waves"))) as Background;
    // Yjs does not keep key order
    const reordered = Object.fromEntries(
      Object.entries(fromYjs).reverse(),
    ) as Background;

    expect(backgroundKey(reordered)).toEqual(backgroundKey(waves));
    expect(backgroundKey(clouds)).not.toEqual(backgroundKey(waves));
    expect(
      backgroundKey(
        backgroundFromMedia({ type: "video", video: video("waves") }, "once"),
      ),
    ).not.toEqual(backgroundKey(waves));
  });

  it("ignores what was recorded about a video when it was picked", () => {
    const again = backgroundFromMedia({
      type: "video",
      video: { ...video("waves"), id: "other", metadata: { duration: 12 } },
    });
    expect(backgroundKey(again)).toBe(backgroundKey(waves));
  });
});
