export type SpotifyEntityType = "track" | "album" | "playlist";

export type SpotifyRef = { type: SpotifyEntityType; id: string };

const ID = "([A-Za-z0-9]{22})";

/**
 * open.spotify.com/playlist/ID, with or without a locale (/intl-de/...), or a
 * spotify:playlist:ID uri. Short spotify.link urls need resolving first
 */
export const parseSpotifyUrl = (value: string): SpotifyRef | null => {
  const text = value.trim();

  const uri = text.match(new RegExp(`^spotify:(track|album|playlist):${ID}$`));
  if (uri) return { type: uri[1] as SpotifyEntityType, id: uri[2]! };

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.hostname !== "open.spotify.com") return null;

  const path = url.pathname.match(
    new RegExp(`^(?:/intl-[\\w-]+)?(?:/embed)?/(track|album|playlist)/${ID}`),
  );
  if (!path) return null;
  return { type: path[1] as SpotifyEntityType, id: path[2]! };
};

/** What the app's share button gives */
export const isSpotifyShortUrl = (value: string) => {
  try {
    return new URL(value.trim()).hostname === "spotify.link";
  } catch {
    return false;
  }
};

export const isSpotifyUrl = (value: string) =>
  !!parseSpotifyUrl(value) || isSpotifyShortUrl(value);
