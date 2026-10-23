import {
  type LayoutDoc,
  type LayoutVideo,
  type Rect,
  type VideoStartMode,
  createLayoutDoc,
  createShapeElement,
  imagePaint,
  solidPaint,
  videoPaint,
} from "@repo/layout";
import { type UniversalURL, extractMediaName } from "@repo/lib";

import type { DriveSlideVideo, SlideVideoSteps } from "../../types";
import type {
  PresentationInfo,
  SlideInfo,
  SlideVideo,
} from "./slideData/types";

export const YOUTUBE_VIDEO_TYPE = 1;
export const DRIVE_VIDEO_TYPE = 2;

type SlideSize = { width: number; height: number };

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const videoRect = (size: SlideSize, video: SlideVideo): Rect => {
  const { x, y, width, height } = video.bounds;
  return {
    x: clampPercent((x / size.width) * 100),
    y: clampPercent((y / size.height) * 100),
    w: clampPercent(((width * video.scaleX) / size.width) * 100),
    h: clampPercent(((height * video.scaleY) / size.height) * 100),
  };
};

const elementId = (video: SlideVideo, index: number) =>
  video.elementId || `video-${index}`;

const youTubeVideo = (video: SlideVideo): LayoutVideo => ({
  id: `youtube-${video.videoId}`,
  url: `https://www.youtube.com/watch?v=${video.videoId}`,
  hlsMediaName: null,
  thumbnailMediaName: null,
  title: video.title || null,
  duration: null,
  thumbnailUrl: video.thumbnailUrl || null,
});

const backdropId = (id: string) => `${id}-backdrop`;
const posterId = (id: string) => `${id}-poster`;

/** Google's still for a video, which import already copied into our media */
const posterSrc = (slide: SlideInfo, id: string): UniversalURL | null => {
  const url = slide.elementImageMap[id];
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  try {
    const { mediaId, extension } = extractMediaName(url.split("/").pop()!);
    return { mediaId, extension };
  } catch {
    return null;
  }
};

const backdrop = (id: string, rect: Rect) =>
  createShapeElement({
    id: backdropId(id),
    name: null,
    rect,
    fill: solidPaint("#000000"),
  });

/**
 * A Drive video we can't play yet: its poster, so the slide doesn't show the
 * embed's error instead
 */
const posterElements = (id: string, rect: Rect, src: UniversalURL | null) => [
  backdrop(id, rect),
  ...(src
    ? [
        createShapeElement({
          id: posterId(id),
          name: null,
          rect,
          fill: imagePaint(src, "contain"),
        }),
      ]
    : []),
];

/**
 * The video over a black box. Google's own player is still in the embed
 * underneath, and shows an error (eg. "Request access") until ours has loaded
 */
const videoElements = (
  id: string,
  name: string | null,
  rect: Rect,
  video: LayoutVideo,
  start: VideoStartMode,
) => [
  backdrop(id, rect),
  createShapeElement({
    id,
    name,
    rect,
    fill: videoPaint(video, "contain", 1, "once", start),
  }),
];

const startMode = (
  steps: SlideVideoSteps | undefined,
  elementId: string,
): VideoStartMode => (steps?.startClicks[elementId] ? "manual" : "auto");

const emptyVideoDoc = (size: SlideSize): LayoutDoc =>
  createLayoutDoc({
    aspectRatio: { width: size.width, height: size.height },
    // The embed letterboxes the slide, so must we
    fitMode: "letterbox",
  });

/**
 * Keyed by local slide index: YouTube videos, and posters for Drive ones.
 * Slides without either are left out
 */
export const buildSlideVideoDocs = (
  presentation: PresentationInfo,
  slideVideos: Record<string, SlideVideoSteps> = {},
): Record<string, LayoutDoc> => {
  const docs: Record<string, LayoutDoc> = {};

  presentation.slides.forEach((slide, slideIndex) => {
    const elements = slide.videos.flatMap((video, i) => {
      if (!video.videoId) return [];
      const id = elementId(video, i);
      const rect = videoRect(presentation, video);

      if (video.videoType === YOUTUBE_VIDEO_TYPE) {
        return videoElements(
          id,
          video.title || null,
          rect,
          youTubeVideo(video),
          startMode(slideVideos[String(slideIndex)], id),
        );
      }
      if (video.videoType === DRIVE_VIDEO_TYPE) {
        return posterElements(id, rect, posterSrc(slide, id));
      }
      return [];
    });

    if (elements.length > 0) {
      docs[String(slideIndex)] = { ...emptyVideoDoc(presentation), elements };
    }
  });

  return docs;
};

export const collectDriveVideos = (
  presentation: PresentationInfo,
): DriveSlideVideo[] =>
  presentation.slides.flatMap((slide, slideIndex) =>
    slide.videos.flatMap((video, i) =>
      video.videoType === DRIVE_VIDEO_TYPE && video.videoId
        ? [
            {
              fileId: video.videoId,
              title: video.title || null,
              slideIndex,
              elementId: elementId(video, i),
              rect: videoRect(presentation, video),
              status: "needsAccess" as const,
              error: null,
            },
          ]
        : [],
    ),
  );

/** The slide's video doc with a downloaded Drive video added (or replaced) */
export const withDriveVideo = (
  existing: LayoutDoc | undefined,
  size: SlideSize,
  driveVideo: DriveSlideVideo,
  video: LayoutVideo,
  steps?: SlideVideoSteps,
): LayoutDoc => {
  const doc = existing ?? emptyVideoDoc(size);
  const elements = videoElements(
    driveVideo.elementId,
    driveVideo.title,
    driveVideo.rect,
    video,
    startMode(steps, driveVideo.elementId),
  );

  return {
    ...doc,
    elements: [
      ...doc.elements.filter(
        (el) =>
          el.id !== driveVideo.elementId &&
          el.id !== backdropId(driveVideo.elementId) &&
          el.id !== posterId(driveVideo.elementId),
      ),
      ...elements,
    ],
  };
};

/**
 * Our steps per slide and the step each video starts on.
 *
 * "Play (on click)" uses the click the embed already has for it. "Play
 * (manually)" has none in the embed (you'd click the video itself), so we add
 * one per such video, after all of the embed's, which the renderer never
 * forwards (see `getEmbedClickCount`). "Play (automatically)" starts on entry.
 */
export const planSlideSteps = (presentation: PresentationInfo) => {
  const clickCounts: number[] = [];
  const slideVideos: Record<string, SlideVideoSteps> = {};

  presentation.slides.forEach((slide, slideIndex) => {
    const startClicks: Record<string, number> = {};
    let added = 0;

    slide.videos.forEach((video, i) => {
      // Only videos we draw get a step. Without an element id one can't be
      // matched to its animation either, so it plays on entry
      const isDrawn =
        !!video.videoId &&
        (video.videoType === YOUTUBE_VIDEO_TYPE ||
          video.videoType === DRIVE_VIDEO_TYPE);
      if (!isDrawn || !video.elementId) return;

      const id = elementId(video, i);
      const onClick = slide.videoClicks[id];
      if (onClick !== undefined) {
        startClicks[id] = onClick;
      } else if (slide.autoplayVideoIds.includes(id)) {
        startClicks[id] = 0;
      } else {
        added += 1;
        startClicks[id] = slide.clickCount + added;
      }
    });

    clickCounts.push(slide.clickCount + added);
    if (Object.keys(startClicks).length > 0) {
      slideVideos[String(slideIndex)] = {
        embedClicks: slide.clickCount,
        startClicks,
      };
    }
  });

  return { clickCounts, slideVideos };
};
