const YOUTUBE_HOSTS = /(^|\.)(youtube\.com|youtu\.be)$/;

/** The playlist a YouTube link points at, if any. */
export const getYoutubePlaylistId = (value: string) => {
  try {
    const url = new URL(value);
    if (!YOUTUBE_HOSTS.test(url.hostname)) return null;

    const playlistId = url.searchParams.get("list");
    if (!playlistId || playlistId.startsWith("RD")) return null;
    return playlistId;
  } catch {
    return null;
  }
};
