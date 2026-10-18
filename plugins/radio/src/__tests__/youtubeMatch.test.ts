import { describe, expect, it } from "vitest";

import { SpotifyTrack } from "../spotify";
import {
  CONFIDENT_SCORE,
  MINIMUM_SCORE,
  YoutubeVideo,
  coreTitle,
  normalize,
  scoreVideo,
} from "../youtubeMatch";

const track: SpotifyTrack = {
  title: "Way Maker (feat. Bethel Music)",
  artist: "Leeland, Bethel Music",
  duration: 300,
};

const video = (overrides: Partial<YoutubeVideo>): YoutubeVideo => ({
  videoId: "aaaaaaaaaaa",
  title: "Leeland - Way Maker (Official Audio)",
  author: "Leeland",
  duration: 301,
  ...overrides,
});

describe("coreTitle", () => {
  it("drops features and version suffixes", () => {
    expect(coreTitle("Way Maker (feat. Bethel Music)")).toBe("Way Maker");
    expect(coreTitle("Oceans - Live")).toBe("Oceans");
    expect(coreTitle("Song [with Someone] - Remastered 2011")).toBe("Song");
  });
});

describe("normalize", () => {
  it("ignores case, accents and punctuation", () => {
    expect(normalize("ADÉLA – Nicole Kidman!")).toBe("adela nicole kidman");
    expect(normalize("for KING & COUNTRY")).toBe("for king and country");
  });
});

describe("scoreVideo", () => {
  it("is confident about the artist's own upload", () => {
    expect(scoreVideo(track, video({}))).toBeGreaterThanOrEqual(
      CONFIDENT_SCORE,
    );
  });

  it("prefers the artist's channel over a re-upload", () => {
    const reupload = video({
      title: "Leeland - Way Maker (Lyrics)",
      author: "Lyrics Daily",
    });
    expect(scoreVideo(track, video({}))).toBeGreaterThan(
      scoreVideo(track, reupload),
    );
  });

  it("prefers the auto-generated Topic upload", () => {
    const topic = video({ title: "Way Maker", author: "Leeland - Topic" });
    const fanVideo = video({ title: "Way Maker - Leeland", author: "Fan" });
    expect(scoreVideo(track, topic)).toBeGreaterThan(
      scoreVideo(track, fanVideo),
    );
  });

  it("marks down other versions of the song", () => {
    const live = video({ title: "Leeland - Way Maker (Live)" });
    const cover = video({ title: "Way Maker | Piano Cover", author: "Keys" });
    expect(scoreVideo(track, live)).toBeLessThan(CONFIDENT_SCORE);
    expect(scoreVideo(track, cover)).toBeLessThan(MINIMUM_SCORE);
  });

  it("allows a version the Spotify title asks for", () => {
    const liveTrack = { ...track, title: "Way Maker - Live" };
    const live = video({ title: "Leeland - Way Maker (Live)" });
    expect(scoreVideo(liveTrack, live)).toBeGreaterThanOrEqual(CONFIDENT_SCORE);
  });

  it("doubts a different song or a much longer video", () => {
    expect(
      scoreVideo(track, video({ title: "Leeland - Lion and the Lamb" })),
    ).toBeLessThan(CONFIDENT_SCORE);
    expect(scoreVideo(track, video({ duration: 600 }))).toBeLessThan(
      scoreVideo(track, video({})),
    );
  });
});
