/**
 * Variant selection for preloading
 *
 * Mirrored from hls.js 1.6.15:
 * - level-controller sorts levels on height before bitrate whenever any level
 *   declares a RESOLUTION, else on bitrate.
 * - on manifest parse, the bandwidth estimate is seeded from the FIRST level in
 *   playlist order, clamped to `abrEwmaDefaultEstimateMax` (5Mbps), and only
 *   when it exceeds the `abrEwmaDefaultEstimate` default (500kbps).
 * - `startLevel` is unset by default, so it resolves to `firstAutoLevel`, which
 *   picks the highest level whose bitrate fits `abrBandWidthFactor` (0.95) of
 *   that estimate.
 */

/** hls.js `abrEwmaDefaultEstimate` */
const DEFAULT_BW_ESTIMATE = 5e5;

/** hls.js `abrEwmaDefaultEstimateMax` */
const MAX_SEEDED_BW_ESTIMATE = 5e6;

/** hls.js `abrBandWidthFactor` */
const BW_FACTOR = 0.95;

export type HlsVariant = {
  url: string;
  bandwidth: number;
  /** From RESOLUTION, when the playlist declares one. */
  height: number | null;
  /** From CODECS, when the playlist declares it. */
  codecs: string | null;
};

const resolveUri = (uri: string, baseUrl: string) =>
  new URL(uri, baseUrl).toString();

/** Parses the `#EXT-X-STREAM-INF` entries of a master playlist, in file order */
export const parseHlsVariants = (
  manifest: string,
  manifestUrl: string,
): HlsVariant[] => {
  const lines = manifest.split(/\r?\n/);
  const variants: HlsVariant[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line.startsWith("#EXT-X-STREAM-INF")) continue;

    const uri = lines
      .slice(i + 1)
      .find((next) => next.trim() && !next.trim().startsWith("#"))
      ?.trim();
    if (!uri) continue;

    // Anchored so AVERAGE-BANDWIDTH does not match as BANDWIDTH
    const bandwidth = Number(line.match(/[,:]BANDWIDTH=(\d+)/)?.[1] ?? 0);
    const height = line.match(/[,:]RESOLUTION=\d+x(\d+)/)?.[1];
    const codecs = line.match(/[,:]CODECS="([^"]*)"/)?.[1];

    variants.push({
      url: resolveUri(uri, manifestUrl),
      bandwidth,
      height: height ? Number(height) : null,
      codecs: codecs ?? null,
    });
  }

  return variants;
};

/** Orders variants the way hls.js orders its levels: height, then bitrate */
export const sortHlsVariants = (variants: HlsVariant[]): HlsVariant[] => {
  // Height only takes precedence when a resolution was found, as in hls.js
  const resolutionFound = variants.some((variant) => variant.height !== null);

  return [...variants].sort((a, b) => {
    if (resolutionFound && a.height !== b.height) {
      return (a.height ?? 0) - (b.height ?? 0);
    }
    return a.bandwidth - b.bandwidth;
  });
};

export type HlsStartSelection = {
  variant: HlsVariant;
  /** Suitable for hls.js `startLevel` */
  level: number;
  /** Whether `level` can be trusted as an hls.js level index */
  indexIsReliable: boolean;
};

/** Matches the level key hls.js dedupes redundant variants on */
const variantKey = (variant: HlsVariant) =>
  `${variant.bandwidth}-${variant.height ?? ""}-${variant.codecs ?? ""}`;

/** The variant hls.js is expected to load first, given a cold bandwidth estimate */
export const selectHlsStartVariant = (
  variants: HlsVariant[],
): HlsStartSelection | undefined => {
  const sorted = sortHlsVariants(variants);
  const first = sorted[0];
  if (!first) return undefined;

  // Every variant must declare a resolution and be distinct, or hls.js may
  // build a shorter level array than ours and shift the indices
  const keys = new Set(sorted.map(variantKey));
  const indexIsReliable =
    keys.size === sorted.length &&
    sorted.every((variant) => variant.height !== null);

  if (sorted.length === 1) {
    return { variant: first, level: 0, indexIsReliable };
  }

  // hls.js seeds its estimate from the first variant in playlist order, not
  // sorted order, and only raises the default
  const firstInPlaylist = variants[0]!;
  const estimate = Math.max(
    DEFAULT_BW_ESTIMATE,
    Math.min(firstInPlaylist.bandwidth, MAX_SEEDED_BW_ESTIMATE),
  );

  // Highest variant that fits the estimate, falling back to the lowest
  let level = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i]!.bandwidth <= estimate * BW_FACTOR) level = i;
  }

  return { variant: sorted[level]!, level, indexIsReliable };
};
