import { describe, expect, it } from "vitest";

import { parseDurationText, toPlaylistVideo } from "../youtubePlaylist";

describe("parseDurationText", () => {
  it("reads minutes and hours", () => {
    expect(parseDurationText("3:55")).toBe(235);
    expect(parseDurationText("1:02:03")).toBe(3723);
  });

  it("ignores badges that aren't a duration", () => {
    expect(parseDurationText("LIVE")).toBeUndefined();
    expect(parseDurationText(undefined)).toBeUndefined();
  });
});

describe("toPlaylistVideo", () => {
  it("reads the newer LockupView", () => {
    expect(
      toPlaylistVideo({
        type: "LockupView",
        content_id: "fOT0BUpITw8",
        content_type: "VIDEO",
        metadata: {
          title: { text: "A Song" },
          metadata: {
            metadata_rows: [
              { metadata_parts: [{ text: { text: "An Artist" } }] },
              { metadata_parts: [{ text: { text: "765M views" } }] },
            ],
          },
        },
        content_image: {
          image: [{ url: "https://i.ytimg.com/a.jpg" }],
          overlays: [{ badges: [{ text: "3:55" }] }, { buttons: [] }],
        },
      }),
    ).toEqual({
      videoId: "fOT0BUpITw8",
      title: "A Song",
      author: "An Artist",
      duration: 235,
      thumbnailUrl: "https://i.ytimg.com/a.jpg",
    });
  });

  it("reads the older PlaylistVideo", () => {
    expect(
      toPlaylistVideo({
        type: "PlaylistVideo",
        id: "dQw4w9WgXcQ",
        is_playable: true,
        title: { text: "Another Song" },
        author: { name: "Someone" },
        duration: { seconds: 212 },
        thumbnails: [{ url: "https://i.ytimg.com/b.jpg" }],
      }),
    ).toEqual({
      videoId: "dQw4w9WgXcQ",
      title: "Another Song",
      author: "Someone",
      duration: 212,
      thumbnailUrl: "https://i.ytimg.com/b.jpg",
    });
  });

  it("skips what can't be played", () => {
    expect(
      toPlaylistVideo({ type: "PlaylistVideo", id: "x", is_playable: false }),
    ).toBeNull();
    expect(
      toPlaylistVideo({
        type: "LockupView",
        content_id: "PL1",
        content_type: "PLAYLIST",
      }),
    ).toBeNull();
    expect(toPlaylistVideo({ type: "ReelItem" })).toBeNull();
  });
});
