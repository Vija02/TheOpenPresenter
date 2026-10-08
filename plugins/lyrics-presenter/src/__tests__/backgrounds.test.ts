import type { InternalVideo } from "@repo/video";
import { describe, expect, it } from "vitest";

import {
  type Background,
  backgroundFromMedia,
  backgroundKey,
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
