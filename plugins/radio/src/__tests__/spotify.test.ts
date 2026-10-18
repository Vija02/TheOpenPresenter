import { describe, expect, it } from "vitest";

import { SPOTIFY_EMBED_TRACK_LIMIT, parseEmbedHtml } from "../spotify";
import { isSpotifyUrl, parseSpotifyUrl } from "../spotifyUrl";

const ID = "37i9dQZF1DXcBWIGoYBM5M";

const embedPage = (entity: unknown) =>
  `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { state: { data: { entity } } } },
  })}</script></html>`;

describe("parseSpotifyUrl", () => {
  it("reads share links, with or without a locale or tracking", () => {
    expect(parseSpotifyUrl(`https://open.spotify.com/playlist/${ID}`)).toEqual({
      type: "playlist",
      id: ID,
    });
    expect(
      parseSpotifyUrl(`https://open.spotify.com/intl-de/album/${ID}?si=abc`),
    ).toEqual({ type: "album", id: ID });
    expect(parseSpotifyUrl(`  spotify:track:${ID} `)).toEqual({
      type: "track",
      id: ID,
    });
  });

  it("ignores what it can't import", () => {
    expect(parseSpotifyUrl(`https://open.spotify.com/artist/${ID}`)).toBeNull();
    expect(parseSpotifyUrl(`https://example.com/playlist/${ID}`)).toBeNull();
    expect(parseSpotifyUrl("worship songs")).toBeNull();
  });

  it("knows a short link is Spotify too", () => {
    expect(isSpotifyUrl("https://spotify.link/AbC123")).toBe(true);
    expect(isSpotifyUrl("https://www.youtube.com/watch?v=x")).toBe(false);
  });
});

describe("parseEmbedHtml", () => {
  it("reads a playlist's tracks", () => {
    const html = embedPage({
      name: "Sunday Set",
      trackList: [
        {
          title: "Way Maker",
          subtitle: "Leeland, Bethel Music",
          duration: 301_500,
        },
        { title: "", subtitle: "Nobody" },
      ],
    });

    expect(parseEmbedHtml(html, "playlist")).toEqual({
      type: "playlist",
      name: "Sunday Set",
      tracks: [
        { title: "Way Maker", artist: "Leeland, Bethel Music", duration: 302 },
      ],
      isTruncated: false,
    });
  });

  it("says when a playlist may go past what the page lists", () => {
    const html = embedPage({
      name: "Long",
      trackList: Array.from({ length: SPOTIFY_EMBED_TRACK_LIMIT }, () => ({
        title: "Song",
        subtitle: "Artist",
      })),
    });
    expect(parseEmbedHtml(html, "playlist").isTruncated).toBe(true);
    // An album page always lists the whole album
    expect(parseEmbedHtml(html, "album").isTruncated).toBe(false);
  });

  it("reads a single track", () => {
    const html = embedPage({
      name: "Goodness of God",
      artists: [{ name: "Bethel Music" }, { name: "Jenn Johnson" }],
      duration: 296_000,
    });

    expect(parseEmbedHtml(html, "track").tracks).toEqual([
      {
        title: "Goodness of God",
        artist: "Bethel Music, Jenn Johnson",
        duration: 296,
      },
    ]);
  });

  it("fails on a page without the data", () => {
    expect(() => parseEmbedHtml("<html></html>", "playlist")).toThrow();
  });
});
