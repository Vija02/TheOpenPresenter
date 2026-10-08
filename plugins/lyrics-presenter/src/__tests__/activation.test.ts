import { LAYOUT_VIDEO_STATES_KEY } from "@repo/base-types";
import type { InternalVideo } from "@repo/video";
import { proxy, snapshot } from "valtio";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import {
  activateLyricSlide,
  backgroundScope,
  valtioLyricsActivationTarget,
  yjsLyricsActivationTarget,
} from "../activation";
import {
  type Background,
  NO_BACKGROUND,
  backgroundFromMedia,
  backgroundKey,
} from "../backgrounds";
import { MAIN_LOOK, builtInLook } from "../looks";
import type { PluginBaseData, PluginRendererData, Song } from "../types";

const video = (id: string): InternalVideo => ({
  id,
  url: `https://example.com/${id}.mp4`,
  isInternalVideo: true,
  hlsMediaName: null,
  thumbnailMediaName: null,
  metadata: {},
});

const waves = backgroundFromMedia({ type: "video", video: video("waves") });
const clouds = backgroundFromMedia(
  { type: "video", video: video("clouds") },
  "once",
);

const plain = backgroundFromMedia({ type: "solid", color: "#000000" });

const song = (
  id: string,
  background: Background | null = waves,
  overrides: Partial<Song> = {},
): Song => ({
  id,
  title: id,
  // Verse (2 slides), Chorus (1)
  content: "[Verse]\na\n-\nb\n[Chorus]\nc",
  setting: { displayType: "sections", sectionOrder: null },
  _imported: false,
  looks: background ? { [MAIN_LOOK]: { template: null, background } } : {},
  ...overrides,
});

const pluginData: PluginBaseData = {
  songs: [
    song("a"),
    song("b"),
    // Falls back to the look
    song("c", null),
    song("d", clouds),
    song("e", NO_BACKGROUND),
  ],
  looks: {
    [MAIN_LOOK]: { ...builtInLook(MAIN_LOOK)!, background: plain },
  },
};

const emptyRendererData = (): PluginRendererData => ({
  songId: null,
  currentIndex: null,
  backgroundRun: null,
});

const keyOf = (background: Background) => backgroundKey(background);

describe("activateLyricSlide", () => {
  it("starts a run on the first slide", () => {
    const data = emptyRendererData();
    activateLyricSlide(valtioLyricsActivationTarget(data), pluginData, "a", 0, {
      now: 100,
    });

    expect(data.songId).toBe("a");
    expect(data.currentIndex).toBe(0);
    expect(data.backgroundRun).toEqual({ key: keyOf(waves), since: 100 });
  });

  it("keeps the run while the background stays the same", () => {
    const data = emptyRendererData();
    const target = valtioLyricsActivationTarget(data);

    activateLyricSlide(target, pluginData, "a", 0, { now: 100 });
    const states = data[LAYOUT_VIDEO_STATES_KEY];
    activateLyricSlide(target, pluginData, "a", 1, { now: 200 });

    expect(data.currentIndex).toBe(1);
    expect(data.backgroundRun).toEqual({ key: keyOf(waves), since: 100 });
    expect(data[LAYOUT_VIDEO_STATES_KEY]).toBe(states);
  });

  it("starts a new run, with fresh video state, when the background changes", () => {
    const data = emptyRendererData();
    const target = valtioLyricsActivationTarget(data);

    activateLyricSlide(target, pluginData, "a", 1, { now: 100 });
    activateLyricSlide(target, pluginData, "d", 0, { now: 200 });

    expect(data.backgroundRun).toEqual({ key: keyOf(clouds), since: 200 });

    // Play once is audible, so the operator gets a state to pause and re-cue
    const states = data[LAYOUT_VIDEO_STATES_KEY]!;
    const scopes = Object.keys(states);
    expect(scopes).toHaveLength(1);
    expect(scopes[0]!.startsWith(backgroundScope(keyOf(clouds)))).toBe(true);
    expect(Object.values(states)[0]).toMatchObject({
      startedAt: 200,
      isPlaying: true,
    });
  });

  it("restarts a run when coming back to it", () => {
    const data = emptyRendererData();
    const target = valtioLyricsActivationTarget(data);

    activateLyricSlide(target, pluginData, "a", 0, { now: 100 });
    activateLyricSlide(target, pluginData, "d", 0, { now: 200 });
    activateLyricSlide(target, pluginData, "a", 1, { now: 300 });

    expect(data.backgroundRun).toEqual({ key: keyOf(waves), since: 300 });
  });

  it("keeps playing across songs that share a background", () => {
    const data = emptyRendererData();
    const target = valtioLyricsActivationTarget(data);

    activateLyricSlide(target, pluginData, "a", 2, { now: 100 });
    activateLyricSlide(target, pluginData, "b", 0, { now: 200 });

    expect(data.songId).toBe("b");
    expect(data.backgroundRun).toEqual({ key: keyOf(waves), since: 100 });
  });

  it("ends the run for a song that says no background", () => {
    const data = emptyRendererData();
    const target = valtioLyricsActivationTarget(data);

    activateLyricSlide(target, pluginData, "a", 0, { now: 100 });
    activateLyricSlide(target, pluginData, "e", 0, { now: 200 });

    expect(data.songId).toBe("e");
    expect(data.backgroundRun).toBeNull();
  });

  it("changes run across songs whose backgrounds differ", () => {
    const data = emptyRendererData();
    const target = valtioLyricsActivationTarget(data);

    activateLyricSlide(target, pluginData, "a", 0, { now: 100 });
    activateLyricSlide(target, pluginData, "c", 0, { now: 200 });

    // Song c falls back to the look's background
    expect(data.backgroundRun?.key).toEqual(keyOf(plain));
    expect(data.backgroundRun?.since).toBe(200);
    // Looping videos are muted and keep no state
    expect(Object.keys(data[LAYOUT_VIDEO_STATES_KEY] ?? {})).toEqual([]);
  });

  it("ends the run when the song is cleared", () => {
    const data = emptyRendererData();
    const target = valtioLyricsActivationTarget(data);

    // Play once, so there is video state to clear
    activateLyricSlide(target, pluginData, "d", 0, { now: 100 });
    activateLyricSlide(target, pluginData, null, null, { now: 200 });

    expect(data.songId).toBeNull();
    expect(data.backgroundRun).toBeNull();
    expect(data[LAYOUT_VIDEO_STATES_KEY]).toEqual({});
  });

  it("writes the same through a Yjs target", () => {
    const doc = new Y.Doc();
    const rendererData = doc.getMap<any>("renderer");

    doc.transact(() => {
      activateLyricSlide(
        yjsLyricsActivationTarget(rendererData),
        pluginData,
        "a",
        0,
        { now: 100 },
      );
    });

    // Read back what came off the wire
    const copy = new Y.Doc();
    Y.applyUpdate(copy, Y.encodeStateAsUpdate(doc));
    const remote = copy.getMap<any>("renderer");

    expect(remote.get("songId")).toBe("a");
    expect(remote.get("currentIndex")).toBe(0);
    expect(yjsLyricsActivationTarget(remote).getBackgroundRun()).toEqual({
      key: keyOf(waves),
      since: 100,
    });

    doc.transact(() => {
      activateLyricSlide(
        yjsLyricsActivationTarget(rendererData),
        pluginData,
        "a",
        1,
        { now: 200 },
      );
    });
    expect(
      yjsLyricsActivationTarget(rendererData).getBackgroundRun()?.since,
    ).toBe(100);
  });

  it("gives the same key from a valtio proxy as from a snapshot", () => {
    const live = proxy(
      JSON.parse(JSON.stringify(pluginData)) as PluginBaseData,
    );
    const data = emptyRendererData();

    activateLyricSlide(valtioLyricsActivationTarget(data), live, "d", 0, {
      now: 100,
    });

    expect(data.backgroundRun?.key).toEqual(keyOf(clouds));
    expect(snapshot(live).songs[3]?.looks[MAIN_LOOK]).toBeTruthy();
  });
});
