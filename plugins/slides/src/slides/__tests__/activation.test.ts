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
import {
  activateSlide,
  updateSlideVideos,
  yjsActivationTarget,
} from "../activation";

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
  it("seeds its playback state as Y.Maps that sync", () => {
    const doc = new Y.Doc();
    const rendererData = doc.getMap<any>("renderer");

    doc.transact(() => {
      activateSlide(yjsActivationTarget(rendererData), pluginData, 1, {
        now: 100,
      });
    });

    // Clients edit fields (eg. volume) in place, so it can't be a plain object
    const states = rendererData.get(LAYOUT_VIDEO_STATES_KEY);
    expect(states).toBeInstanceOf(Y.Map);
    const key = videoFillKey({ scope: "deck:1", elementId: "vid" });
    expect(states.get(key)).toBeInstanceOf(Y.Map);

    const copy = new Y.Doc();
    Y.applyUpdate(copy, Y.encodeStateAsUpdate(doc));
    expect(copy.getMap<any>("renderer").toJSON()).toMatchObject({
      currentSlideIndex: 1,
      [LAYOUT_VIDEO_STATES_KEY]: {
        [key]: { isPlaying: true, startedAt: 100, seek: 0 },
      },
    });
  });
});

describe("videos that start on a click", () => {
  const video = (id: string, start: "auto" | "manual" = "auto") =>
    createShapeElement({
      id,
      rect: { x: 0, y: 0, w: 50, h: 50 },
      fill: videoPaint(
        {
          id: `media_${id}`,
          url: `/media/data/media_${id}.mp4`,
          hlsMediaName: null,
          thumbnailMediaName: null,
          title: null,
          duration: null,
          thumbnailUrl: null,
        },
        "contain",
        1,
        "once",
        start,
      ),
    });

  const gatedDeck: PluginBaseData = {
    imports: {
      deck: {
        ...deck,
        slideClickCounts: [0, 1],
        slideVideoDocs: {
          // As import makes it: a video that waits is `start: "manual"`
          "1": createLayoutDoc({
            elements: [video("auto"), video("manual", "manual")],
          }),
        },
        // "auto" plays on entry; "manual" on our added step
        slideVideos: {
          "1": { embedClicks: 0, startClicks: { auto: 0, manual: 1 } },
        },
      },
    },
    slideOrder: ["deck:0", "deck:1"],
  };

  const key = (elementId: string) =>
    videoFillKey({ scope: "deck:1", elementId });

  const setup = () => {
    const doc = new Y.Doc();
    const rendererData = doc.getMap<any>("renderer");
    const target = yjsActivationTarget(rendererData);
    const states = () => target.getVideoStates()!;
    return { doc, target, states };
  };

  it("holds it on its first frame until its click, then starts it", () => {
    const { doc, target, states } = setup();

    doc.transact(() =>
      activateSlide(target, gatedDeck, 1, { clickCount: 0, now: 100 }),
    );
    expect(states()[key("auto")]).toMatchObject({ isPlaying: true });
    expect(states()[key("manual")]).toMatchObject({
      isPlaying: false,
      seek: 0,
    });
    const autoUid = states()[key("auto")]!.uid;

    doc.transact(() =>
      updateSlideVideos(target, gatedDeck, 1, { from: 0, to: 1 }, 500),
    );
    expect(states()[key("manual")]).toMatchObject({
      isPlaying: true,
      startedAt: 500,
      seek: 0,
    });
    // The one already playing carries on rather than restarting
    expect(states()[key("auto")]!.uid).toBe(autoUid);
  });

  it("rewinds it when stepping back before its click", () => {
    const { doc, target, states } = setup();

    doc.transact(() =>
      activateSlide(target, gatedDeck, 1, { clickCount: 1, now: 100 }),
    );
    expect(states()[key("manual")]).toMatchObject({ isPlaying: true });

    doc.transact(() =>
      updateSlideVideos(target, gatedDeck, 1, { from: 1, to: 0 }, 900),
    );
    expect(states()[key("manual")]).toMatchObject({
      isPlaying: false,
      seek: 0,
    });
  });

  it("keeps the volume set on it when it restarts", () => {
    const { doc, target, states } = setup();

    doc.transact(() =>
      activateSlide(target, gatedDeck, 1, { clickCount: 0, now: 100 }),
    );
    doc.transact(() =>
      target.setVideoStates({
        ...states(),
        [key("manual")]: { ...states()[key("manual")]!, volume: 0.3 },
      }),
    );

    doc.transact(() =>
      updateSlideVideos(target, gatedDeck, 1, { from: 0, to: 1 }, 500),
    );
    expect(states()[key("manual")]).toMatchObject({
      isPlaying: true,
      volume: 0.3,
    });
  });

  it("doesn't start them all when stepping back onto the slide", () => {
    const { doc, target, states } = setup();

    // PREV from the next slide lands on the last click, but nothing was
    // clicked: only the automatic video plays
    doc.transact(() =>
      activateSlide(target, gatedDeck, 1, {
        clickCount: 1,
        now: 100,
        startLandedVideo: false,
      }),
    );
    expect(states()[key("auto")]).toMatchObject({ isPlaying: true });
    expect(states()[key("manual")]).toMatchObject({ isPlaying: false });
  });

  it("leaves videos a click doesn't concern as they are", () => {
    const { doc, target, states } = setup();

    doc.transact(() =>
      activateSlide(target, gatedDeck, 1, { clickCount: 0, now: 100 }),
    );
    // Say the operator paused the automatic one
    doc.transact(() =>
      target.setVideoStates({
        ...states(),
        [key("auto")]: {
          ...states()[key("auto")]!,
          isPlaying: false,
          seek: 0.4,
        },
      }),
    );

    doc.transact(() =>
      updateSlideVideos(target, gatedDeck, 1, { from: 0, to: 1 }, 500),
    );
    expect(states()[key("auto")]).toMatchObject({
      isPlaying: false,
      seek: 0.4,
    });
    expect(states()[key("manual")]).toMatchObject({ isPlaying: true });
  });

  it("plays them all on entry when the slide is shown as an image", () => {
    const { doc, target, states } = setup();
    const rendererData = doc.getMap<any>("renderer");

    // An image has no clicks to wait for
    doc.transact(() => {
      rendererData.set("displayModes", { deck: "image" });
      activateSlide(target, gatedDeck, 1, { clickCount: 0, now: 100 });
    });
    expect(states()[key("manual")]).toMatchObject({ isPlaying: true });
  });
});
