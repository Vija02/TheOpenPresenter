import {
  SpotifyEntityType,
  SpotifyRef,
  isSpotifyShortUrl,
  parseSpotifyUrl,
} from "./spotifyUrl";

/** The embed page lists no more than this, and doesn't say how many there are */
export const SPOTIFY_EMBED_TRACK_LIMIT = 100;

const FETCH_TIMEOUT_MS = 10_000;
// The embed page is only server-rendered for browsers
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export type SpotifyTrack = {
  title: string;
  /** All of them, comma separated */
  artist: string;
  /** In seconds */
  duration?: number;
};

export type SpotifyCollection = {
  type: SpotifyEntityType;
  name: string;
  tracks: SpotifyTrack[];
  isTruncated: boolean;
};

const fetchText = async (url: string) => {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Spotify responded with ${res.status}`);
  return { url: res.url, text: await res.text() };
};

/** spotify.link redirects through a page that holds the real link */
const resolveShortUrl = async (url: string): Promise<SpotifyRef | null> => {
  const res = await fetchText(url);
  const fromRedirect = parseSpotifyUrl(res.url);
  if (fromRedirect) return fromRedirect;

  const link = res.text.match(
    /https:\/\/open\.spotify\.com\/(?:intl-[\w-]+\/)?(?:track|album|playlist)\/[A-Za-z0-9]{22}/,
  );
  return link ? parseSpotifyUrl(link[0]) : null;
};

const toSeconds = (ms: unknown) =>
  typeof ms === "number" && ms > 0 ? Math.round(ms / 1000) : undefined;

// Spotify joins artists with a non-breaking space
const cleanText = (text: unknown) =>
  typeof text === "string" ? text.replace(/\u00a0/g, " ").trim() : "";

export const parseEmbedHtml = (
  html: string,
  type: SpotifyEntityType,
): SpotifyCollection => {
  const json = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  )?.[1];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entity: any = json
    ? JSON.parse(json)?.props?.pageProps?.state?.data?.entity
    : null;
  if (!entity) throw new Error("Couldn't read the Spotify page");

  if (type === "track") {
    return {
      type,
      name: cleanText(entity.name ?? entity.title),
      tracks: [
        {
          title: cleanText(entity.name ?? entity.title),
          artist: (entity.artists ?? [])
            .map((x: { name?: string }) => cleanText(x.name))
            .filter(Boolean)
            .join(", "),
          duration: toSeconds(entity.duration),
        },
      ],
      isTruncated: false,
    };
  }

  const tracks: SpotifyTrack[] = (entity.trackList ?? [])
    .map((x: { title?: string; subtitle?: string; duration?: number }) => ({
      title: cleanText(x.title),
      artist: cleanText(x.subtitle),
      duration: toSeconds(x.duration),
    }))
    .filter((x: SpotifyTrack) => !!x.title);

  return {
    type,
    name: cleanText(entity.name ?? entity.title),
    tracks,
    isTruncated:
      type === "playlist" && tracks.length >= SPOTIFY_EMBED_TRACK_LIMIT,
  };
};

export const getSpotifyCollection = async (
  url: string,
): Promise<SpotifyCollection> => {
  const ref = isSpotifyShortUrl(url)
    ? await resolveShortUrl(url)
    : parseSpotifyUrl(url);
  if (!ref) throw new Error("Not a Spotify track, album or playlist link");

  const { text } = await fetchText(
    `https://open.spotify.com/embed/${ref.type}/${ref.id}`,
  );
  return parseEmbedHtml(text, ref.type);
};
