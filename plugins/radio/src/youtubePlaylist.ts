import type { Innertube } from "youtubei.js";

/** Keeps a huge playlist from flooding the shared data */
export const MAX_PLAYLIST_VIDEOS = 200;

export type PlaylistVideo = {
  videoId: string;
  title: string;
  author?: string;
  duration?: number;
  thumbnailUrl?: string;
};

/** "1:02:03" → 3723 */
export const parseDurationText = (text: string | undefined) => {
  if (!text || !/^\d+(:\d{1,2})*$/.test(text.trim())) return undefined;
  return text
    .trim()
    .split(":")
    .reduce((total, part) => total * 60 + Number(part), 0);
};

/**
 * YouTube serves playlist items either as the older PlaylistVideo or the newer
 * LockupView. Anything that isn't a playable video comes back as null
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toPlaylistVideo = (node: any): PlaylistVideo | null => {
  if (node?.type === "PlaylistVideo") {
    if (!node.id || node.is_playable === false) return null;
    return {
      videoId: node.id,
      title: node.title?.text ?? "",
      author: node.author?.name,
      duration: node.duration?.seconds || undefined,
      thumbnailUrl: node.thumbnails?.[0]?.url,
    };
  }

  if (node?.type === "LockupView") {
    if (node.content_type !== "VIDEO" || !node.content_id) return null;

    const badges: { text?: string }[] =
      node.content_image?.overlays?.flatMap(
        (x: { badges?: unknown[] }) => x.badges ?? [],
      ) ?? [];
    const duration = badges
      .map((x) => parseDurationText(x.text))
      .find((x) => x !== undefined);

    return {
      videoId: node.content_id,
      title: node.metadata?.title?.text ?? "",
      author:
        node.metadata?.metadata?.metadata_rows?.[0]?.metadata_parts?.[0]?.text
          ?.text,
      duration,
      thumbnailUrl: node.content_image?.image?.[0]?.url,
    };
  }

  return null;
};

export const getPlaylistVideos = async (yt: Innertube, playlistId: string) => {
  let page = await yt.getPlaylist(playlistId);
  const title = page.info.title;
  const videos: PlaylistVideo[] = [];

  while (true) {
    for (const node of page.items) {
      const video = toPlaylistVideo(node);
      if (video) videos.push(video);
    }
    if (videos.length >= MAX_PLAYLIST_VIDEOS || !page.has_continuation) break;
    page = await page.getContinuation();
  }

  return {
    title,
    videos: videos.slice(0, MAX_PLAYLIST_VIDEOS),
    isTruncated: videos.length > MAX_PLAYLIST_VIDEOS || page.has_continuation,
  };
};
