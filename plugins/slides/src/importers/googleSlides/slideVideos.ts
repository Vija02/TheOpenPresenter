import {
  type LayoutDoc,
  type LayoutVideo,
  type Rect,
  createLayoutDoc,
  createShapeElement,
  imagePaint,
  solidPaint,
  videoPaint,
} from "@repo/layout";
import { type UniversalURL, extractMediaName } from "@repo/lib";

import type { DriveSlideVideo } from "../../types";
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
) => [
  backdrop(id, rect),
  createShapeElement({
    id,
    name,
    rect,
    fill: videoPaint(video, "contain", 1, "once"),
  }),
];

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
): LayoutDoc => {
  const doc = existing ?? emptyVideoDoc(size);
  const elements = videoElements(
    driveVideo.elementId,
    driveVideo.title,
    driveVideo.rect,
    video,
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
