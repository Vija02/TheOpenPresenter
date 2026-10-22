import { describe, expect, it } from "vitest";

import { parsePresentationInfo } from "../googleSlides/slideData/slideDataExtractor";
import type {
  PresentationInfo,
  SlideInfo,
  SlideVideo,
} from "../googleSlides/slideData/types";
import { buildSlideVideoDocs } from "../googleSlides/slideVideos";

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

const slide = (videos: SlideVideo[]): SlideInfo => ({
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

  it("leaves out videos it can't play yet", () => {
    const docs = buildSlideVideoDocs(
      presentation([slide([video({ videoType: 2 })])]),
    );

    expect(docs).toEqual({});
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
