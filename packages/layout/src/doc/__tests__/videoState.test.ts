import { describe, expect, it } from "vitest";

import { createLayoutDoc, createShapeElement } from "../../schema/defaults";
import {
  type VideoStartMode,
  videoPaint,
  videoPaintValidator,
} from "../../schema/paint";
import { videoFillKey } from "../edit";
import {
  type LayoutVideoStates,
  type VideoStateTarget,
  activateVideoFills,
  controlVideoFills,
} from "../videoState";

const video = (id: string, start: VideoStartMode = "auto") =>
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

const key = (elementId: string) => videoFillKey({ scope: "s", elementId });

const memoryTarget = () => {
  let states: LayoutVideoStates | undefined;
  const target: VideoStateTarget = {
    getVideoStates: () => states,
    setVideoStates: (next) => {
      states = next;
    },
  };
  return { target, states: () => states! };
};

/** A doc on screen with an auto video "a" and a manual video "b" */
const onScreen = () => {
  const memory = memoryTarget();
  activateVideoFills(
    memory.target,
    [
      {
        scope: "s",
        doc: createLayoutDoc({ elements: [video("a"), video("b", "manual")] }),
      },
    ],
    100,
  );
  return memory;
};

describe("a video's start setting", () => {
  it("plays an auto video on screen and holds a manual one on its first frame", () => {
    const { states } = onScreen();

    expect(states()[key("a")]).toMatchObject({ isPlaying: true, seek: 0 });
    expect(states()[key("b")]).toMatchObject({ isPlaying: false, seek: 0 });
  });

  it("defaults to auto for documents stored before it existed", () => {
    const { start: _, ...stored } = video("a").fill as Record<string, unknown>;

    expect(videoPaintValidator.parse(stored).start).toBe("auto");
  });
});

describe("controlVideoFills", () => {
  it("starts a video from the first frame", () => {
    const { target, states } = onScreen();

    controlVideoFills(
      target,
      [{ scope: "s", elementId: "b", playing: true, seek: 0 }],
      500,
    );

    expect(states()[key("b")]).toMatchObject({
      isPlaying: true,
      startedAt: 500,
      seek: 0,
    });
  });

  it("rewinds a video and holds it there", () => {
    const { target, states } = onScreen();

    controlVideoFills(
      target,
      [{ scope: "s", elementId: "a", playing: false, seek: 0 }],
      500,
    );

    expect(states()[key("a")]).toMatchObject({ isPlaying: false, seek: 0 });
  });

  it("leaves every other video as it is, even one paused by hand", () => {
    const { target, states } = onScreen();
    controlVideoFills(
      target,
      [{ scope: "s", elementId: "a", playing: false, seek: 0.4 }],
      200,
    );
    const pausedA = states()[key("a")];

    controlVideoFills(
      target,
      [{ scope: "s", elementId: "b", playing: true, seek: 0 }],
      500,
    );

    expect(states()[key("a")]).toBe(pausedA);
  });

  it("resumes a paused video from where it was paused", () => {
    const { target, states } = onScreen();
    controlVideoFills(
      target,
      [{ scope: "s", elementId: "a", playing: false, seek: 0.4 }],
      200,
    );

    controlVideoFills(
      target,
      [{ scope: "s", elementId: "a", playing: true }],
      500,
    );

    expect(states()[key("a")]).toMatchObject({
      isPlaying: true,
      seek: 0.4,
      startedAt: 500,
    });
  });

  it("doesn't restart a video that is already playing", () => {
    const { target, states } = onScreen();
    const playing = states()[key("a")];

    controlVideoFills(
      target,
      [{ scope: "s", elementId: "a", playing: true }],
      500,
    );

    expect(states()[key("a")]).toEqual(playing);
  });

  it("seeks without changing whether it plays", () => {
    const { target, states } = onScreen();

    controlVideoFills(target, [{ scope: "s", elementId: "a", seek: 0.5 }], 500);

    expect(states()[key("a")]).toMatchObject({
      isPlaying: true,
      seek: 0.5,
      startedAt: 500,
    });
  });

  it("changes the volume without making it jump", () => {
    const { target, states } = onScreen();
    const before = states()[key("a")]!;

    controlVideoFills(
      target,
      [{ scope: "s", elementId: "a", volume: 0.3, muted: true }],
      500,
    );

    expect(states()[key("a")]).toEqual({ ...before, volume: 0.3, muted: true });
  });

  it("keeps the volume and mute when it starts one", () => {
    const { target, states } = onScreen();
    controlVideoFills(
      target,
      [{ scope: "s", elementId: "b", volume: 0.3, muted: true }],
      200,
    );

    controlVideoFills(
      target,
      [{ scope: "s", elementId: "b", playing: true, seek: 0 }],
      500,
    );

    expect(states()[key("b")]).toMatchObject({
      isPlaying: true,
      volume: 0.3,
      muted: true,
    });
  });

  it("writes nothing when given nothing to do", () => {
    const { target, states } = onScreen();
    const before = states();

    controlVideoFills(target, [], 500);

    expect(states()).toBe(before);
  });
});
