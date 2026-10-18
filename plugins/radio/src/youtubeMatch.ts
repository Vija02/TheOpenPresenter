import type { Innertube, YTNodes } from "youtubei.js";

import type { SpotifyTrack } from "./spotify";

export type YoutubeVideo = {
  videoId: string;
  title: string;
  author?: string;
  duration?: number;
  durationText?: string;
  thumbnailUrl?: string;
};

export type ScoredVideo = YoutubeVideo & { score: number };

/** At or above this, the match is taken without asking */
export const CONFIDENT_SCORE = 0.7;
/** Below this, it's likely the wrong song, so it isn't picked by default */
export const MINIMUM_SCORE = 0.4;

const CANDIDATES_PER_TRACK = 3;
const RESULTS_TO_SCORE = 10;

// A different take on the song, unless the Spotify title says so too
const VERSION_WORDS = [
  "live",
  "cover",
  "karaoke",
  "instrumental",
  "remix",
  "reaction",
  "slowed",
  "reverb",
  "sped",
  "nightcore",
  "8d",
  "acoustic",
  "tutorial",
  "lesson",
  "chords",
  "loop",
];

export const searchVideos = async (
  yt: Innertube,
  query: string,
): Promise<YoutubeVideo[]> => {
  const res = await yt.search(query, { type: "video" });
  return (res.results.filter((x) => x.type === "Video") as YTNodes.Video[]).map(
    (x) => ({
      videoId: x.video_id,
      title: x.title.text ?? "",
      author: x.author.name,
      duration: x.duration.seconds,
      durationText: x.duration.text,
      thumbnailUrl: x.thumbnails[x.thumbnails.length - 1]?.url,
    }),
  );
};

export const normalize = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const tokens = (text: string) => normalize(text).split(" ").filter(Boolean);

/** "Song (feat. X) - Live at Y" → "Song", what any upload of it is called */
export const coreTitle = (title: string) =>
  title
    .replace(/\s*[([](?:feat|ft|with)\.?\s[^)\]]*[)\]]/gi, "")
    .split(" - ")[0]!
    .trim();

export const primaryArtist = (artist: string) =>
  artist.split(",")[0]?.trim() ?? "";

const durationScore = (expected?: number, actual?: number) => {
  if ((expected ?? 0) <= 0 || (actual ?? 0) <= 0) return 0.3;
  const diff = Math.abs(expected! - actual!);
  if (diff <= 3) return 1;
  if (diff <= 10) return 0.8;
  if (diff <= 30) return 0.4;
  return 0;
};

export const scoreVideo = (track: SpotifyTrack, video: YoutubeVideo) => {
  const videoTitle = normalize(video.title);
  const videoWords = new Set(videoTitle.split(" "));
  const author = normalize(video.author ?? "");

  const titleWords = tokens(coreTitle(track.title));
  const titleScore =
    titleWords.length > 0
      ? titleWords.filter((x) => videoWords.has(x)).length / titleWords.length
      : 0;

  // The artist's own channel beats an upload that only names them
  const artists = track.artist.split(",").map(normalize).filter(Boolean);
  const credit = (name: string) =>
    !name ? 0 : author.includes(name) ? 1 : videoTitle.includes(name) ? 0.8 : 0;
  const artistScore = Math.max(
    credit(artists[0] ?? ""),
    ...artists.slice(1).map((x) => credit(x) * 0.7),
  );

  const allowed = new Set(tokens(track.title));
  const versionWords = VERSION_WORDS.filter(
    (x) => videoWords.has(x) && !allowed.has(x),
  );
  const penalty = Math.min(versionWords.length * 0.4, 0.6);

  // Auto-generated "Artist - Topic" uploads are the studio recording
  const bonus =
    (author.endsWith(" topic") ? 0.1 : 0) +
    (/official (audio|video)/.test(videoTitle) ? 0.05 : 0);

  return (
    0.45 * titleScore +
    0.25 * artistScore +
    0.3 * durationScore(track.duration, video.duration) -
    penalty +
    bonus
  );
};

/** How sure we are, from 0 to 1. The raw score can go past 1 to rank */
const confidence = (score: number) => Math.max(0, Math.min(1, score));

/** The likeliest uploads of a track, best first */
export const findYoutubeMatches = async (
  yt: Innertube,
  track: SpotifyTrack,
): Promise<ScoredVideo[]> => {
  const query = `${primaryArtist(track.artist)} ${coreTitle(track.title)}`;
  const videos = await searchVideos(yt, query);
  return videos
    .slice(0, RESULTS_TO_SCORE)
    .map((video) => ({ video, score: scoreVideo(track, video) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATES_PER_TRACK)
    .map(({ video, score }) => ({ ...video, score: confidence(score) }));
};
