import { describe, expect, it } from "vitest";

import {
  parseHlsVariants,
  selectHlsStartVariant,
  sortHlsVariants,
} from "../hlsVariant";

const BASE = "https://cdn.test/v/master.m3u8";

/** Mirrors what backend/worker medias__transcodeVideoToHLS.ts emits */
const OUR_MASTER = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=958000,RESOLUTION=640x360
/media/data/media_360.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1635000,RESOLUTION=842x480
/media/data/media_480.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3134000,RESOLUTION=1280x720
/media/data/media_720.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5565000,RESOLUTION=1920x1080
/media/data/media_1080.m3u8
`;

describe("parseHlsVariants", () => {
  it("reads bandwidth and resolution height, resolving relative uris", () => {
    const variants = parseHlsVariants(OUR_MASTER, BASE);

    expect(variants).toEqual([
      {
        url: "https://cdn.test/media/data/media_360.m3u8",
        bandwidth: 958000,
        height: 360,
        codecs: null,
      },
      {
        url: "https://cdn.test/media/data/media_480.m3u8",
        bandwidth: 1635000,
        height: 480,
        codecs: null,
      },
      {
        url: "https://cdn.test/media/data/media_720.m3u8",
        bandwidth: 3134000,
        height: 720,
        codecs: null,
      },
      {
        url: "https://cdn.test/media/data/media_1080.m3u8",
        bandwidth: 5565000,
        height: 1080,
        codecs: null,
      },
    ]);
  });

  it("does not mistake AVERAGE-BANDWIDTH for BANDWIDTH", () => {
    const manifest = `#EXTM3U
#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=111,BANDWIDTH=999,RESOLUTION=640x360
low.m3u8
`;

    expect(parseHlsVariants(manifest, BASE)[0]!.bandwidth).toBe(999);
  });

  it("returns nothing for a media playlist", () => {
    const playlist = "#EXTM3U\n#EXTINF:6.0,\n0.ts\n";

    expect(parseHlsVariants(playlist, BASE)).toEqual([]);
  });
});

describe("sortHlsVariants", () => {
  it("sorts on height when a resolution is declared", () => {
    // Bitrate order deliberately disagrees with height order
    const manifest = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=9000,RESOLUTION=640x360
small.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1000,RESOLUTION=1920x1080
big.m3u8
`;

    expect(
      sortHlsVariants(parseHlsVariants(manifest, BASE)).map((x) => x.height),
    ).toEqual([360, 1080]);
  });

  it("falls back to bitrate when no resolution is declared", () => {
    const manifest = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=9000
high.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1000
low.m3u8
`;

    expect(
      sortHlsVariants(parseHlsVariants(manifest, BASE)).map((x) => x.bandwidth),
    ).toEqual([1000, 9000]);
  });
});

describe("selectHlsStartVariant", () => {
  it("picks 360p for our own transcode ladder, matching a cold hls.js", () => {
    // hls.js seeds its estimate from the first variant (958kbps), and no
    // variant fits 0.95 of that, so it clamps to the first level
    const selection = selectHlsStartVariant(parseHlsVariants(OUR_MASTER, BASE));

    expect(selection?.variant.height).toBe(360);
    expect(selection?.level).toBe(0);
    expect(selection?.indexIsReliable).toBe(true);
  });

  it("climbs the ladder when the playlist advertises a fast first variant", () => {
    const manifest = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080
1080.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360
360.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720
720.m3u8
`;

    // Estimate seeds to 4Mbps, so 720p (2Mbps) fits but 1080p (4Mbps) does not
    const selection = selectHlsStartVariant(parseHlsVariants(manifest, BASE));

    expect(selection?.variant.height).toBe(720);
    // Sorted ladder is 360, 720, 1080, so the pinned index is 1
    expect(selection?.level).toBe(1);
    expect(selection?.indexIsReliable).toBe(true);
  });

  it("never returns undefined for a single variant playlist", () => {
    const manifest = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=99000000,RESOLUTION=3840x2160
only.m3u8
`;

    expect(
      selectHlsStartVariant(parseHlsVariants(manifest, BASE))?.variant.height,
    ).toBe(2160);
  });

  it("handles an empty ladder", () => {
    expect(selectHlsStartVariant([])).toBeUndefined();
  });

  it("refuses to pin when a variant declares no resolution", () => {
    // hls.js may drop or reorder such a ladder, so our index cannot be trusted
    const manifest = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=900000
a.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1800000,RESOLUTION=1280x720
b.m3u8
`;

    const selection = selectHlsStartVariant(parseHlsVariants(manifest, BASE));

    // Still worth warming, just not worth pinning
    expect(selection?.variant).toBeDefined();
    expect(selection?.indexIsReliable).toBe(false);
  });

  it("refuses to pin when two variants are indistinguishable", () => {
    // hls.js dedupes these into one level, shifting every later index
    const manifest = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360
a.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360
b.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1800000,RESOLUTION=1280x720
c.m3u8
`;

    const selection = selectHlsStartVariant(parseHlsVariants(manifest, BASE));

    expect(selection?.indexIsReliable).toBe(false);
  });

  it("pins distinct same-resolution variants that differ by codec", () => {
    const manifest = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360,CODECS="avc1.42e01e"
a.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360,CODECS="hvc1.1.6.L93"
b.m3u8
`;

    const selection = selectHlsStartVariant(parseHlsVariants(manifest, BASE));

    expect(selection?.indexIsReliable).toBe(true);
  });
});
