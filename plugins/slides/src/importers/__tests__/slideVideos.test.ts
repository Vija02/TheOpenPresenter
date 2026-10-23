import { describe, expect, it } from "vitest";

import { parsePresentationInfo } from "../googleSlides/slideData/slideDataExtractor";
import type {
  PresentationInfo,
  SlideInfo,
  SlideVideo,
} from "../googleSlides/slideData/types";
import {
  buildSlideVideoDocs,
  collectDriveVideos,
  withDriveVideo,
} from "../googleSlides/slideVideos";

const video = (overrides: Partial<SlideVideo> = {}): SlideVideo => ({
  videoId: "abc123",
  videoType: 1,
  bounds: { x: 100, y: 50, width: 200, height: 100 },
  startTime: 0,
  endTime: 0,
  title: "Welcome",
  description: "",
  elementId: "g1_video",
  blobId: "",
  thumbnailUrl: "",
  scaleX: 1,
  scaleY: 1,
  ...overrides,
});

const slide = (
  videos: SlideVideo[],
  overrides: Partial<SlideInfo> = {},
): SlideInfo => ({
  slideId: "s",
  slideIndex: 0,
  title: "",
  videos,
  animations: { sequences: [], autoPlay: false },
  speakerNotes: "",
  imageUrls: [],
  elementImageMap: {},
  clickCount: 0,
  hasAnimations: false,
  hasSlideTransition: false,
  slideTransitionDurationMs: 0,
  clickDurationsMs: [],
  hasAutoplayObject: false,
  autoplayObjectDurationMs: 0,
  videoClicks: {},
  autoplayVideoIds: [],
  ...overrides,
});

const presentation = (slides: SlideInfo[]): PresentationInfo => ({
  width: 400,
  height: 200,
  slides,
  slideCount: slides.length,
});

describe("buildSlideVideoDocs", () => {
  it("places a YouTube video where it sits on the slide", () => {
    const docs = buildSlideVideoDocs(
      presentation([slide([]), slide([video({ scaleX: 0.5 })])]),
    );

    expect(Object.keys(docs)).toEqual(["1"]);

    const doc = docs["1"]!;
    expect(doc.aspectRatio).toEqual({ width: 400, height: 200 });
    expect(doc.fitMode).toBe("letterbox");

    // A black box first, so Google's own player never shows through
    expect(doc.elements[0]).toMatchObject({
      id: "g1_video-backdrop",
      fill: { type: "solid", color: "#000000" },
    });
    const element = doc.elements[1]!;
    expect(element.id).toBe("g1_video");
    expect(element.rect).toEqual({ x: 25, y: 25, w: 25, h: 50 });
    expect(element.fill).toMatchObject({
      type: "video",
      playback: "once",
      video: { url: "https://www.youtube.com/watch?v=abc123" },
    });
  });

  it("covers Drive videos with their poster until they're downloaded", () => {
    const docs = buildSlideVideoDocs(
      presentation([
        slide([video({ videoType: 2 })], {
          elementImageMap: {
            g1_video: "/media/data/media_01m5dz8867enev8qavp0jry3ej.jpg",
          },
        }),
        // No poster: a black box still hides the embed's error
        slide([video({ videoType: 2 })]),
      ]),
    );

    expect(docs["0"]!.elements.map((el) => el.id)).toEqual([
      "g1_video-backdrop",
      "g1_video-poster",
    ]);
    expect(docs["0"]!.elements[1]!.fill).toMatchObject({
      type: "image",
      src: { mediaId: "media_01m5dz8867enev8qavp0jry3ej", extension: "jpg" },
    });
    expect(docs["1"]!.elements.map((el) => el.id)).toEqual([
      "g1_video-backdrop",
    ]);
  });
});

describe("Drive videos", () => {
  const drive = presentation([
    slide([]),
    slide([video({ videoType: 2, videoId: "drive-1" })]),
  ]);

  it("tracks them as needing access, with their place on the slide", () => {
    expect(collectDriveVideos(drive)).toEqual([
      {
        fileId: "drive-1",
        title: "Welcome",
        slideIndex: 1,
        elementId: "g1_video",
        rect: { x: 25, y: 25, w: 50, h: 50 },
        status: "needsAccess",
        error: null,
      },
    ]);
  });

  it("joins the slide's video doc once downloaded", () => {
    const [driveVideo] = collectDriveVideos(drive);
    const layoutVideo = {
      id: "media_1",
      url: "/media/data/media_1.mp4",
      hlsMediaName: null,
      thumbnailMediaName: null,
      title: "Welcome",
      duration: null,
      thumbnailUrl: null,
    };

    const doc = withDriveVideo(undefined, drive, driveVideo!, layoutVideo);
    expect(doc.fitMode).toBe("letterbox");
    expect(doc.elements).toHaveLength(2);
    expect(doc.elements[1]!.fill).toMatchObject({
      type: "video",
      playback: "once",
      video: { url: "/media/data/media_1.mp4" },
    });

    // Fetching again replaces it rather than stacking a second copy
    const again = withDriveVideo(doc, drive, driveVideo!, layoutVideo);
    expect(again.elements).toHaveLength(2);
  });
});

describe("video bounds in docData", () => {
  it("are two corners, not a size", () => {
    // Measured on a real deck: a centred 9:16 video
    const videoArray = Array.from({ length: 19 }, () => null as unknown);
    videoArray[0] = "drive-1";
    videoArray[1] = 2;
    videoArray[2] = [128444, 6096, 237316, 199645];
    const slideArray = Array.from({ length: 15 }, () => null as unknown);
    slideArray[0] = "s";
    slideArray[4] = [videoArray];

    const info = parsePresentationInfo([[365760, 205740], [slideArray]])!;
    const { bounds } = info.slides[0]!.videos[0]!;

    expect(bounds).toEqual({
      x: 128444,
      y: 6096,
      width: 108872,
      height: 193549,
    });
    // Centred on the slide
    expect(bounds.x + bounds.width / 2).toBe(365760 / 2);
  });
});

describe("a Drive video arriving", () => {
  it("takes its poster's place", () => {
    const deck = presentation([
      slide([video({ videoType: 2, videoId: "drive-1" })], {
        elementImageMap: {
          g1_video: "/media/data/media_01m5dz8867enev8qavp0jry3ej.jpg",
        },
      }),
    ]);
    const [driveVideo] = collectDriveVideos(deck);
    const covered = buildSlideVideoDocs(deck)["0"];

    const doc = withDriveVideo(covered, deck, driveVideo!, {
      id: "media_1",
      url: "/media/data/media_1.mp4",
      hlsMediaName: null,
      thumbnailMediaName: null,
      title: null,
      duration: null,
      thumbnailUrl: null,
    });

    expect(doc.elements.map((el) => el.id)).toEqual([
      "g1_video-backdrop",
      "g1_video",
    ]);
  });
});
