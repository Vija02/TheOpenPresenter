import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UniversalVideo } from "../../../types";
import {
  getVideoPreloadStatus,
  preloadVideo,
  resetVideoPreload,
} from "../videoPreload";

const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

const MASTER = `#EXTM3U
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=1800000,BANDWIDTH=2000000,RESOLUTION=1920x1080
1080/index.m3u8
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=400000,BANDWIDTH=500000,RESOLUTION=640x360
360/index.m3u8
`;

const MEDIA_PLAYLIST = `#EXTM3U
#EXTINF:6.0,
0.ts
#EXTINF:6.0,
1.ts
#EXTINF:6.0,
2.ts
#EXTINF:6.0,
3.ts
`;

/** Bypasses media name resolution so these tests cover the queue, not @repo/lib */
const video = (url: string): UniversalVideo => ({
  id: url,
  url,
  metadata: {},
});

describe("videoPreload", () => {
  let fetched: string[];

  beforeEach(() => {
    fetched = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        fetched.push(url);

        const body = url.endsWith("master.m3u8")
          ? MASTER
          : url.endsWith(".m3u8")
            ? MEDIA_PLAYLIST
            : "segment-bytes";

        return {
          ok: true,
          status: 200,
          text: async () => body,
          arrayBuffer: async () => new ArrayBuffer(body.length),
        };
      }),
    );
  });

  afterEach(() => {
    resetVideoPreload();
    vi.unstubAllGlobals();
  });

  it("walks the manifest tree and warms the lowest bitrate variant", async () => {
    preloadVideo(video("https://cdn.test/v/master.m3u8"), "eager");
    await flush();

    // Both variant playlists get read so bitrates can be compared
    expect(fetched).toContain("https://cdn.test/v/1080/index.m3u8");
    expect(fetched).toContain("https://cdn.test/v/360/index.m3u8");

    // Segments come from the low variant only, capped at three, relative to
    // that variant's own playlist url
    expect(fetched.filter((url) => url.endsWith(".ts"))).toEqual([
      "https://cdn.test/v/360/0.ts",
      "https://cdn.test/v/360/1.ts",
      "https://cdn.test/v/360/2.ts",
    ]);
  });

  it("handles a media playlist with no variants", async () => {
    preloadVideo(video("https://cdn.test/direct/index.m3u8"), "eager");
    await flush();

    expect(fetched.filter((url) => url.endsWith(".ts"))).toEqual([
      "https://cdn.test/direct/0.ts",
      "https://cdn.test/direct/1.ts",
      "https://cdn.test/direct/2.ts",
    ]);
  });

  it("reaches ready and dedupes repeat requests for the same url", async () => {
    const url = "https://cdn.test/dedupe/master.m3u8";

    preloadVideo(video(url), "eager");
    await flush();

    expect(getVideoPreloadStatus(url)).toBe("ready");

    const callsAfterFirst = fetched.length;
    preloadVideo(video(url), "eager");
    await flush();

    expect(fetched).toHaveLength(callsAfterFirst);
  });

  it("skips youtube urls, which own their own loading", async () => {
    const url = "https://www.youtube.com/watch?v=abc";

    preloadVideo(video(url), "eager");
    await flush();

    expect(fetched).toHaveLength(0);
    expect(getVideoPreloadStatus(url)).toBe("idle");
  });

  it("records an error rather than retrying forever", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, text: async () => "" })),
    );

    const url = "https://cdn.test/missing/master.m3u8";
    preloadVideo(video(url), "eager");
    await flush();

    expect(getVideoPreloadStatus(url)).toBe("error");
  });

  it("runs at most two warms at once", async () => {
    let inFlight = 0;
    let peak = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight--;

        return {
          ok: true,
          status: 200,
          text: async () => (url.endsWith(".m3u8") ? MEDIA_PLAYLIST : ""),
          arrayBuffer: async () => new ArrayBuffer(4),
        };
      }),
    );

    const urls = Array.from(
      { length: 6 },
      (_, i) => `https://cdn.test/many/${i}/index.m3u8`,
    );
    for (const url of urls) preloadVideo(video(url), "background");

    await vi.waitFor(() =>
      expect(urls.every((url) => getVideoPreloadStatus(url) === "ready")).toBe(
        true,
      ),
    );

    expect(peak).toBeLessThanOrEqual(2);
  });

  it("lets an eager video jump ahead of queued background ones", async () => {
    const started: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        started.push(url);
        await new Promise((resolve) => setTimeout(resolve, 5));

        return {
          ok: true,
          status: 200,
          text: async () => "#EXTM3U\n",
          arrayBuffer: async () => new ArrayBuffer(4),
        };
      }),
    );

    // Fill both slots, then queue background work behind them
    for (let i = 0; i < 4; i++) {
      preloadVideo(video(`https://cdn.test/bg/${i}/index.m3u8`), "background");
    }
    preloadVideo(video("https://cdn.test/urgent/index.m3u8"), "eager");

    await vi.waitFor(() =>
      expect(getVideoPreloadStatus("https://cdn.test/urgent/index.m3u8")).toBe(
        "ready",
      ),
    );

    // The urgent one ran before the two still-queued background videos
    expect(started.indexOf("https://cdn.test/urgent/index.m3u8")).toBeLessThan(
      started.indexOf("https://cdn.test/bg/3/index.m3u8"),
    );
  });
});
