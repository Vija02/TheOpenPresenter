/**
 * Warms an HLS stream into the HTTP cache.
 */
import { parseHlsVariants, selectHlsStartVariant } from "./hlsVariant";

const SEGMENT_COUNT = 3;

const MAX_SEGMENT_BYTES = 8 * 1024 * 1024;

const fetchText = async (url: string, signal: AbortSignal) => {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Preload failed with ${response.status} for ${url}`);
  }
  return response.text();
};

/** Downloads and discards the body so the response lands in the HTTP cache. */
const fetchBytes = async (url: string, signal: AbortSignal) => {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Preload failed with ${response.status} for ${url}`);
  }
  const buffer = await response.arrayBuffer();
  return buffer.byteLength;
};

const resolveUri = (uri: string, baseUrl: string) =>
  new URL(uri, baseUrl).toString();

const parseSegments = (playlist: string, playlistUrl: string): string[] =>
  playlist
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((uri) => resolveUri(uri, playlistUrl));

const warmSegments = async (segments: string[], signal: AbortSignal) => {
  let bytes = 0;

  for (const segment of segments.slice(0, SEGMENT_COUNT)) {
    if (bytes >= MAX_SEGMENT_BYTES) return;
    bytes += await fetchBytes(segment, signal);
  }
};

/**
 * Fetches the manifest tree and the first few segments of the variant the
 * player will be pinned to
 *
 * Returns the level the player should start on, or null when there is nothing
 * safe to pin
 */
export const warmHlsStream = async (
  url: string,
  signal: AbortSignal,
): Promise<number | null> => {
  const manifest = await fetchText(url, signal);
  const variants = parseHlsVariants(manifest, url);

  // A media playlist rather than a master playlist
  if (variants.length === 0) {
    await warmSegments(parseSegments(manifest, url), signal);
    return null;
  }

  const selection = selectHlsStartVariant(variants);
  if (!selection) return null;

  const playlist = await fetchText(selection.variant.url, signal);

  await warmSegments(parseSegments(playlist, selection.variant.url), signal);

  return selection.indexIsReliable ? selection.level : null;
};
