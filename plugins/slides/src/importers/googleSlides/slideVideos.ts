import {
  type LayoutDoc,
  type LayoutVideo,
  type Rect,
  createLayoutDoc,
  createShapeElement,
  solidPaint,
  videoPaint,
} from "@repo/layout";

import type { PresentationInfo, SlideVideo } from "./slideData/types";

export const YOUTUBE_VIDEO_TYPE = 1;

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

/**
 * The video over a black box. Google's own player is still in the embed
 * underneath, and can show through until ours has loaded
 */
const videoElements = (
  id: string,
  name: string | null,
  rect: Rect,
  video: LayoutVideo,
) => [
  createShapeElement({
    id: backdropId(id),
    name: null,
    rect,
    fill: solidPaint("#000000"),
  }),
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

/** Keyed by local slide index. Slides without YouTube videos are left out */
export const buildSlideVideoDocs = (
  presentation: PresentationInfo,
): Record<string, LayoutDoc> => {
  const docs: Record<string, LayoutDoc> = {};

  presentation.slides.forEach((slide, slideIndex) => {
    const elements = slide.videos.flatMap((video, i) =>
      video.videoType === YOUTUBE_VIDEO_TYPE && video.videoId
        ? videoElements(
            elementId(video, i),
            video.title || null,
            videoRect(presentation, video),
            youTubeVideo(video),
          )
        : [],
    );

    if (elements.length > 0) {
      docs[String(slideIndex)] = { ...emptyVideoDoc(presentation), elements };
    }
  });

  return docs;
};
