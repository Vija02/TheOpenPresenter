import type { MediaPickerResult } from "@repo/base-types";
import { mediaIdFromUUID } from "@repo/lib";
import { describe, expect, it } from "vitest";

import {
  createHostElement,
  createLayoutDoc,
  createShapeElement,
  createTextElement,
} from "../../../schema/defaults";
import { solidPaint } from "../../../schema/paint";
import { addMediaElement } from "../../addElement";
import {
  mediaClickTarget,
  mediaDropTarget,
  setElementFill,
} from "../mediaDrop";
import { mediaMatchesFill, mediaPreviewData, mediaToFill } from "../mediaItem";

const background = createShapeElement({
  id: "bg",
  fill: solidPaint("#000"),
  locked: true,
});
const picture = createShapeElement({
  id: "pic",
  rect: { x: 50, y: 0, w: 50, h: 50 },
});
const caption = createTextElement({
  id: "caption",
  content: "Hello",
  rect: { x: 0, y: 0, w: 100, h: 100 },
});
const line = createShapeElement({
  id: "line",
  kind: "line",
  rect: { x: 0, y: 40, w: 100, h: 1 },
});

// Paint order: background, picture, line, caption on top
const doc = createLayoutDoc({
  elements: [background, picture, line, caption],
});

describe("mediaDropTarget", () => {
  it("passes through text to the topmost shape under the point", () => {
    expect(mediaDropTarget(doc, { x: 75, y: 25 })).toBe("pic");
    expect(mediaDropTarget(doc, { x: 25, y: 75 })).toBe("bg");
  });

  it("skips lines, hidden elements and live content", () => {
    expect(mediaDropTarget(doc, { x: 10, y: 40.5 })).toBe("bg");

    const hidden = createLayoutDoc({
      elements: [
        background,
        { ...picture, hidden: true },
        createHostElement({
          id: "host",
          source: { kind: "screen", rendererId: "r" },
          rect: { x: 0, y: 0, w: 100, h: 100 },
        }),
      ],
    });
    expect(mediaDropTarget(hidden, { x: 75, y: 25 })).toBe("bg");
  });

  it("finds nothing over empty stage", () => {
    const sparse = createLayoutDoc({ elements: [picture] });
    expect(mediaDropTarget(sparse, { x: 10, y: 90 })).toBeNull();
  });
});

describe("mediaClickTarget", () => {
  it("uses a single selected element, text included", () => {
    expect(mediaClickTarget(doc, ["caption"])).toBe("caption");
    expect(mediaClickTarget(doc, ["pic"])).toBe("pic");
  });

  it("adds instead for no selection, several, or a line", () => {
    expect(mediaClickTarget(doc, [])).toBeNull();
    expect(mediaClickTarget(doc, ["pic", "bg"])).toBeNull();
    expect(mediaClickTarget(doc, ["line"])).toBeNull();
  });
});

describe("applying media", () => {
  const image: MediaPickerResult = {
    id: "1",
    mediaName: "0b4ef3a3-5c87-4d8b-9a46-6d8ac1b0a4c6.jpg",
    originalName: "sunrise.jpg",
    fileExtension: "jpg",
    url: "https://example.com/sunrise.jpg",
  };
  const video: MediaPickerResult = {
    id: "2",
    mediaName: "clip.mp4",
    originalName: "clip.mp4",
    fileExtension: "mp4",
    url: "https://example.com/clip.mp4",
    internalVideo: {
      id: "video_1",
      url: "https://example.com/clip.mp4",
      isInternalVideo: true,
      hlsMediaName: null,
      thumbnailMediaName: null,
      metadata: { title: "clip", thumbnailUrl: "https://example.com/t.jpg" },
    },
  };

  it("turns pictures and videos into fills, and nothing else", () => {
    expect(mediaToFill(image)?.type).toBe("image");
    expect(mediaToFill(video)?.type).toBe("video");
    expect(
      mediaToFill({ ...image, fileExtension: "pdf", mediaName: "a.pdf" }),
    ).toBeNull();
  });

  it("keeps a video equal however often it is picked", () => {
    const again = {
      ...video,
      internalVideo: { ...video.internalVideo!, id: "video_2" },
    };
    expect(mediaToFill(again)).toEqual(mediaToFill(video));
  });

  it("knows which item a fill shows", () => {
    expect(mediaMatchesFill(image, mediaToFill(image))).toBe(true);
    expect(mediaMatchesFill(video, mediaToFill(video))).toBe(true);
    expect(mediaMatchesFill(image, mediaToFill(video))).toBe(false);
    expect(mediaMatchesFill(video, solidPaint("#000"))).toBe(false);
    expect(mediaMatchesFill(image, null)).toBe(false);
  });

  it("shows a still for each", () => {
    expect(
      mediaPreviewData({ ...image, processing: null }).videoMetadata,
    ).toBeNull();

    // The library's ids, which the preview turns back into the same names
    const thumbnail = mediaIdFromUUID(crypto.randomUUID()) + ".jpg";
    const processed = {
      ...video,
      internalVideo: { ...video.internalVideo!, thumbnailMediaName: thumbnail },
    };
    const meta = mediaPreviewData({
      ...processed,
      processing: null,
    }).videoMetadata;
    expect(mediaIdFromUUID(meta!.thumbnailMediaId!) + ".jpg").toBe(thumbnail);
    expect(meta!.hlsMediaId).toBeNull();
    expect(meta!.transcodeStatus).toBe("COMPLETED");

    // Still processing: the preview overlays its progress
    const busy = mediaPreviewData({
      ...processed,
      processing: { status: "PROCESSING", progress: 42 },
    }).videoMetadata;
    expect(busy!.transcodeStatus).toBe("PROCESSING");
    expect(busy!.transcodeProgress).toBe(42);
  });

  it("replaces only the target's fill", () => {
    const fill = mediaToFill(image)!;
    const next = setElementFill(doc, "bg", fill);
    expect(next.elements[0]?.fill).toEqual(fill);
    expect(next.elements.slice(1)).toEqual(doc.elements.slice(1));
  });

  it("adds a new element centred on the drop, kept on the stage", () => {
    const fill = mediaToFill(image)!;
    const { doc: added, id } = addMediaElement(
      createLayoutDoc({ elements: [] }),
      fill,
      { center: { x: 95, y: 50 } },
    );
    const element = added.elements.find((e) => e.id === id)!;
    expect(element.fill).toEqual(fill);
    expect(element.rect.x + element.rect.w).toBeLessThanOrEqual(100);
    expect(element.rect.y + element.rect.h / 2).toBeCloseTo(50);
  });
});
