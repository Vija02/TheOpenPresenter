import { useEffect, useMemo, useState } from "react";

/**
 * Sprite sheets held in memory, so a slide change never goes back to the
 * network whatever the cache headers (or DevTools) say. Sheets are kept
 * compressed as blob urls; only the slides one press away are decoded, since a
 * decoded 1080p sheet costs ~8MB and a deck can have dozens.
 */

type Entry = {
  /** Blob url once downloaded; the network url stands in until then */
  blobUrl: string | null;
  done: Promise<void>;
};

const entries = new Map<string, Entry>();
/** Decoded images we hold on to; letting go lets the browser drop the pixels */
const decoded = new Map<string, HTMLImageElement>();

const claims = new Map<symbol, ReadonlySet<string>>();
const decodeClaims = new Map<symbol, ReadonlySet<string>>();

const claimed = (from: Map<symbol, ReadonlySet<string>>) => {
  const all = new Set<string>();
  for (const urls of from.values()) urls.forEach((url) => all.add(url));
  return all;
};

const load = (url: string): Entry => {
  const existing = entries.get(url);
  if (existing) return existing;
  const entry: Entry = { blobUrl: null, done: Promise.resolve() };
  entry.done = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`${res.status}`);
      return res.blob();
    })
    .then((blob) => {
      entry.blobUrl = URL.createObjectURL(blob);
    })
    // Fall back to the network url rather than show nothing
    .catch(() => {});
  entries.set(url, entry);
  return entry;
};

/** The url to draw with: the in-memory copy once it's there */
export const spriteUrl = (url: string) => entries.get(url)?.blobUrl ?? url;

const decode = async (url: string) => {
  if (decoded.has(url)) return;
  const img = new Image();
  decoded.set(url, img);
  img.src = spriteUrl(url);
  await img.decode().catch(() => {});
};

/** Frees sheets no store wants any more */
const forget = () => {
  const keep = claimed(claims);
  for (const [url, entry] of entries) {
    if (keep.has(url)) continue;
    if (entry.blobUrl) URL.revokeObjectURL(entry.blobUrl);
    entries.delete(url);
    decoded.delete(url);
  }
};

/** Lets go of decoded sheets no store wants decoded any more */
const releaseDecoded = () => {
  const keep = claimed(decodeClaims);
  for (const url of decoded.keys()) {
    if (!keep.has(url)) decoded.delete(url);
  }
};

/** Downloaded already, possibly by another store */
const isDownloaded = (url: string) => !!entries.get(url)?.blobUrl;

/**
 * Downloads every url in `all`, decodes those in `decodeUrls` (letting go of
 * any others), and says when `all` and `required` are in memory. Re-renders as
 * sheets arrive so callers pick up the blob urls.
 */
export const useSpriteStore = ({
  all,
  required,
  decodeUrls,
}: {
  all: string[];
  required: string[];
  decodeUrls: string[];
}) => {
  const [token] = useState(() => Symbol("sprites"));
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(new Set());

  useEffect(
    () => () => {
      claims.delete(token);
      decodeClaims.delete(token);
      forget();
      releaseDecoded();
    },
    [token],
  );

  useEffect(() => {
    let cancelled = false;
    claims.set(token, new Set(all));
    forget();
    for (const url of all) {
      void load(url).done.then(() => {
        if (cancelled) return;
        setLoaded((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [all, token]);

  useEffect(() => {
    decodeClaims.set(token, new Set(decodeUrls));
    releaseDecoded();
    // Decode from memory, so wait for each download first
    for (const url of decodeUrls) {
      void load(url).done.then(() => decode(url));
    }
  }, [decodeUrls, token]);

  const has = (url: string) => loaded.has(url) || isDownloaded(url);

  // A new function as sheets arrive, so memos built on it swap in blob urls
  const resolve = useMemo(
    () => (url: string) => spriteUrl(url),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded],
  );

  return {
    allLoaded: all.every(has),
    ready: required.every(has),
    resolve,
  };
};
