import {
  type FillPaint,
  type LayoutDoc,
  type LayoutVideo,
  type VideoPlaybackMode,
  createLayoutDoc,
  createShapeElement,
  imagePaint,
  solidPaint,
  toLayoutVideo,
  videoPaint,
} from "@repo/layout";
import type { UniversalURL } from "@repo/lib";
import type { InternalVideo } from "@repo/video";
import { hash } from "ohash";

import { BACKGROUND_ELEMENT_ID } from "./template/ids";
import type { Song } from "./types";

export { BACKGROUND_ELEMENT_ID };

/** One full-bleed element whose fill is a video, image or colour */
export type Background = LayoutDoc;

export type KeyedBackground = { key: string; background: Background };

export type ResolvedBackground = KeyedBackground | null;

export type BackgroundMedia =
  | { type: "video"; video: InternalVideo | LayoutVideo }
  | { type: "image"; src: UniversalURL }
  | { type: "solid"; color: string };

const isLayoutVideo = (
  video: InternalVideo | LayoutVideo,
): video is LayoutVideo => !("metadata" in video);

export const backgroundFromMedia = (
  media: BackgroundMedia,
  playback: VideoPlaybackMode = "loop",
): Background => {
  const fill =
    media.type === "video"
      ? videoPaint(
          isLayoutVideo(media.video) ? media.video : toLayoutVideo(media.video),
          "cover",
          1,
          playback,
        )
      : media.type === "image"
        ? imagePaint(media.src, "cover")
        : solidPaint(media.color);

  return backgroundFromFill(fill);
};

/** Fixed id and defaults, so equal fills give equal docs, and so equal keys */
export const backgroundFromFill = (fill: FillPaint): Background =>
  createLayoutDoc({
    elements: [
      createShapeElement({
        id: BACKGROUND_ELEMENT_ID,
        name: "Background",
        fill,
        locked: true,
      }),
    ],
  });

/** The fill of the background's element */
export const backgroundFill = (background: Background) =>
  background.elements[0]?.fill ?? null;

export const backgroundPlayback = (
  background: Background,
): VideoPlaybackMode | null => {
  const fill = backgroundFill(background);
  return fill?.type === "video" ? (fill.playback ?? "loop") : null;
};

export const withBackgroundPlayback = (
  background: Background,
  playback: VideoPlaybackMode,
): Background => ({
  ...background,
  elements: background.elements.map((element) =>
    element.fill?.type === "video"
      ? { ...element, fill: { ...element.fill, playback } }
      : element,
  ),
});

/**
 * A video is the same video whatever was recorded about it when picked: its
 * id, title, duration and poster vary between picks and sources
 */
const identity = (background: Background) => ({
  ...background,
  elements: background.elements.map((element) =>
    element.fill?.type === "video"
      ? { ...element, fill: { ...element.fill, video: element.fill.video.url } }
      : element,
  ),
});

/** Stable across sources, so identical backgrounds share a run */
export const backgroundKey = (background: Background): string =>
  hash(identity(background));

/**
 * An explicit "no background". Where null means "fall back", as for a song,
 * this is how to say none
 */
export const NO_BACKGROUND: Background = createLayoutDoc({ elements: [] });

export const isNoBackground = (background: Background | null | undefined) =>
  !!background && background.elements.length === 0;

const keyed = (background: Background | null): ResolvedBackground =>
  background && !isNoBackground(background)
    ? { key: backgroundKey(background), background }
    : null;

/** The song's own, else the scene's. Every slide of a song shows it */
export const resolveSongBackground = (
  song: Pick<Song, "background">,
  sceneBackground: Background | null,
): ResolvedBackground => keyed(song.background ?? sceneBackground);

/** Everything the output may need to show, to preload */
export const resolveSceneBackgrounds = (
  songs: Pick<Song, "background">[],
  sceneBackground: Background | null,
): KeyedBackground[] => {
  const seen = new Map<string, KeyedBackground>();
  for (const song of songs) {
    const entry = resolveSongBackground(song, sceneBackground);
    if (entry && !seen.has(entry.key)) seen.set(entry.key, entry);
  }
  return [...seen.values()];
};
