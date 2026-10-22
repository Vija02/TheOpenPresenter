import { LAYOUT_VIDEO_STATES_KEY } from "@repo/base-types";
import {
  createLayoutDoc,
  createShapeElement,
  videoFillKey,
  videoPaint,
} from "@repo/layout";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import type { GoogleSlidesImportData, PluginBaseData } from "../../types";
import { activateSlide, yjsActivationTarget } from "../activation";

const deck: GoogleSlidesImportData = {
  importId: "deck",
  fetchId: "f",
  type: "googleslides",
  presentationId: "p",
  html: "",
  thumbnailLinks: ["a.jpg", "b.jpg"],
  slideClickCounts: [0, 0],
  slideIds: ["s0", "s1"],
  slideVideoDocs: {
    "1": createLayoutDoc({
      elements: [
        createShapeElement({
          id: "vid",
          rect: { x: 0, y: 0, w: 50, h: 50 },
          fill: videoPaint(
            {
              id: "media_1",
              url: "/media/data/media_1.mp4",
              hlsMediaName: null,
              thumbnailMediaName: null,
              title: null,
              duration: null,
              thumbnailUrl: null,
            },
            "contain",
            1,
            "once",
          ),
        }),
      ],
    }),
  },
};

const pluginData: PluginBaseData = {
  imports: { deck },
  slideOrder: ["deck:0", "deck:1"],
};

describe("activating an imported slide with a video", () => {
  it("seeds its playback state, like a custom slide's", () => {
    const doc = new Y.Doc();
    const rendererData = doc.getMap<any>("renderer");

    doc.transact(() => {
      activateSlide(yjsActivationTarget(rendererData), pluginData, 1, {
        now: 100,
      });
    });

    const key = videoFillKey({ scope: "deck:1", elementId: "vid" });
    expect(rendererData.toJSON()).toMatchObject({
      currentSlideIndex: 1,
      [LAYOUT_VIDEO_STATES_KEY]: {
        [key]: { isPlaying: true, startedAt: 100, seek: 0 },
      },
    });
  });
});
