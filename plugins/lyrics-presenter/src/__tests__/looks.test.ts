import type { InternalVideo } from "@repo/video";
import { describe, expect, it } from "vitest";

import {
  type Background,
  NO_BACKGROUND,
  backgroundFromMedia,
  backgroundKey,
} from "../backgrounds";
import {
  FULL_SONG_LOOK,
  LOWER_THIRD_LOOK,
  type LookMap,
  MAIN_LOOK,
  builtInLook,
  listLooks,
  lookKeyFor,
  resolveLook,
  resolveSceneBackgrounds,
  resolveSongBackground,
  sameBackground,
  songLookTemplate,
} from "../looks";
import { lyricsDoc } from "../template/presets";
import type { Song } from "../types";

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

const topTemplate = lyricsDoc({ style: { valign: "top" } });

const looks: LookMap = {
  [MAIN_LOOK]: {
    ...builtInLook(MAIN_LOOK)!,
    template: topTemplate,
    background: plain,
  },
  stage: {
    key: "stage",
    name: "Stage",
    position: 10,
    template: lyricsDoc(),
    background: null,
  },
};

type SongBits = Pick<Song, "looks" | "setting">;

const song = (
  background: Background | null,
  displayType: "sections" | "fullSong" = "sections",
): SongBits => ({
  setting: { displayType },
  looks: background
    ? {
        [displayType === "fullSong" ? FULL_SONG_LOOK : MAIN_LOOK]: {
          template: null,
          background,
        },
      }
    : {},
});

describe("looks", () => {
  it("lists the built-ins, as edited, then the organization's", () => {
    expect(listLooks(looks).map((x) => x.key)).toEqual([
      MAIN_LOOK,
      FULL_SONG_LOOK,
      LOWER_THIRD_LOOK,
      "stage",
    ]);
    expect(listLooks(looks)[0]!.template).toBe(topTemplate);
    // Scenes from before looks have no copy
    expect(listLooks(undefined)).toHaveLength(3);
  });

  it("falls back to the built-in, then main for a look that's gone", () => {
    expect(resolveLook(looks, FULL_SONG_LOOK)).toBe(
      builtInLook(FULL_SONG_LOOK),
    );
    expect(resolveLook(looks, "deleted")).toBe(looks[MAIN_LOOK]);
    expect(resolveLook(null, "deleted")).toBe(builtInLook(MAIN_LOOK));
  });

  it("shows a song in the look for its display", () => {
    expect(lookKeyFor({ setting: { displayType: "sections" } })).toBe(
      MAIN_LOOK,
    );
    expect(lookKeyFor({ setting: { displayType: "fullSong" } })).toBe(
      FULL_SONG_LOOK,
    );
  });

  it("uses a song's own template for that look only", () => {
    const own = lyricsDoc({ style: { valign: "bottom" } });
    const withOwn = {
      looks: { [MAIN_LOOK]: { template: own, background: null } },
    };
    expect(songLookTemplate(withOwn, MAIN_LOOK, looks)).toBe(own);
    expect(songLookTemplate(withOwn, LOWER_THIRD_LOOK, looks)).toBe(
      builtInLook(LOWER_THIRD_LOOK)!.template,
    );
    // Songs from before looks
    expect(songLookTemplate({} as SongBits, MAIN_LOOK, looks)).toBe(
      topTemplate,
    );
  });
});

describe("resolveSongBackground", () => {
  it("uses the song's own background", () => {
    expect(resolveSongBackground(song(waves), looks)?.key).toBe(
      backgroundKey(waves),
    );
  });

  it("falls back to the look's", () => {
    expect(resolveSongBackground(song(null), looks)?.key).toBe(
      backgroundKey(plain),
    );
    expect(resolveSongBackground(song(null, "fullSong"), looks)?.key).toBe(
      backgroundKey(builtInLook(FULL_SONG_LOOK)!.background!),
    );
  });

  it("shows nothing when neither is set", () => {
    expect(
      resolveSongBackground(song(null), looks, LOWER_THIRD_LOOK),
    ).toBeNull();
  });

  it("shows nothing, not the look's, when the song says none", () => {
    expect(resolveSongBackground(song(NO_BACKGROUND), looks)).toBeNull();
  });
});

describe("resolveSceneBackgrounds", () => {
  it("de-duplicates across songs, look fallback included", () => {
    const reachable = resolveSceneBackgrounds(
      [
        song(waves),
        song(bg("waves")),
        song(clouds),
        song(null),
        song(NO_BACKGROUND),
      ],
      looks,
    );

    expect(reachable.map((x) => x.key).sort()).toEqual(
      [waves, clouds, plain].map(backgroundKey).sort(),
    );
  });
});

describe("sameBackground", () => {
  it("counts an explicit none as none", () => {
    expect(sameBackground(NO_BACKGROUND, null)).toBe(true);
    expect(sameBackground(bg("waves"), waves)).toBe(true);
    expect(sameBackground(NO_BACKGROUND, plain)).toBe(false);
  });
});
