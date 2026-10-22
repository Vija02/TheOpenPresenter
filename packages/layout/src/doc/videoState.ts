import { LAYOUT_VIDEO_STATES_KEY } from "@repo/base-types";
import type { VideoPlaybackState } from "@repo/video";

import type { LayoutDoc } from "../schema/document";
import { audibleVideoElements, videoFillKey } from "./edit";

/** Keyed by `videoFillKey`: the placement, not the video id. */
export type LayoutVideoStates = Record<string, VideoPlaybackState>;

export type DesiredVideoFill = {
  key: string;
  scope: string;
  elementId: string;
  playing: boolean;
};

export type ScopedLayoutDoc = {
  scope: string;
  doc: LayoutDoc;
};

export const desiredVideoFills = (
  docs: ScopedLayoutDoc[],
): DesiredVideoFill[] =>
  docs.flatMap(({ scope, doc }) =>
    audibleVideoElements(doc).map((element) => ({
      key: videoFillKey({ scope, elementId: element.id }),
      scope,
      elementId: element.id,
      playing: element.start !== "manual",
    })),
  );

/** From the first frame, playing or held there */
const freshState = (
  key: string,
  playing: boolean,
  existing: VideoPlaybackState | undefined,
  now: number,
): VideoPlaybackState => ({
  // A fresh uid is what tells the player to seek rather than carry on
  uid: `${now}-${key}`,
  isPlaying: playing,
  volume: existing?.volume ?? 1,
  muted: existing?.muted ?? false,
  seek: 0,
  startedAt: now,
  onFinishBehaviour: "pause",
});

/**
 * Bring the stored video states in line with what is newly on screen
 */
export const reconcileVideoStates = (
  current: LayoutVideoStates | undefined,
  desired: DesiredVideoFill[],
  now: number,
): LayoutVideoStates | null => {
  const next: LayoutVideoStates = {};

  for (const video of desired) {
    next[video.key] = freshState(
      video.key,
      video.playing,
      current?.[video.key],
      now,
    );
  }

  const changed =
    Object.keys(current ?? {}).length !== Object.keys(next).length ||
    Object.keys(next).some((key) => {
      const a = current?.[key];
      const b = next[key]!;
      return !a || a.uid !== b.uid || a.startedAt !== b.startedAt;
    });

  return changed ? next : null;
};

export type VideoStateTarget = {
  getVideoStates: () => LayoutVideoStates | undefined;
  setVideoStates: (next: LayoutVideoStates) => void;
};

/** Call whenever what is displayed changes. Returns whether anything changed. */
export const activateVideoFills = (
  target: VideoStateTarget,
  docs: ScopedLayoutDoc[],
  now: number = Date.now(),
): boolean => {
  const next = reconcileVideoStates(
    target.getVideoStates(),
    desiredVideoFills(docs),
    now,
  );

  if (next === null) return false;

  target.setVideoStates(next);
  return true;
};

/** What to do to one video on screen */
export type VideoFillControl = {
  scope: string;
  elementId: string;
  playing?: boolean;
  seek?: number;
  volume?: number;
  muted?: boolean;
};

const applyControl = (
  key: string,
  existing: VideoPlaybackState | undefined,
  { playing, seek, volume, muted }: VideoFillControl,
  now: number,
): VideoPlaybackState => {
  const base = existing ?? freshState(key, false, undefined, now);
  const next: VideoPlaybackState = {
    ...base,
    ...(volume === undefined ? {} : { volume }),
    ...(muted === undefined ? {} : { muted }),
  };

  const moves = playing !== undefined || seek !== undefined;
  const alreadyPlaying =
    playing === true && seek === undefined && base.isPlaying;
  if (!moves || alreadyPlaying) return next;

  // A fresh uid is what tells the player to seek rather than carry on
  return {
    ...next,
    uid: `${now}-${key}`,
    isPlaying: playing ?? base.isPlaying,
    seek: seek ?? base.seek,
    startedAt: now,
  };
};

/**
 * Play, pause, seek or change the volume of videos on screen
 */
export const controlVideoFills = (
  target: VideoStateTarget,
  controls: VideoFillControl[],
  now: number = Date.now(),
): void => {
  if (controls.length === 0) return;

  const current = target.getVideoStates();
  const next: LayoutVideoStates = { ...current };
  for (const control of controls) {
    const key = videoFillKey(control);
    next[key] = applyControl(key, current?.[key], control, now);
  }
  target.setVideoStates(next);
};

/** Pass the proxy from `pluginApi.renderer.useValtioData()` */
export const valtioVideoStateTarget = (mutableRendererData: {
  [LAYOUT_VIDEO_STATES_KEY]?: LayoutVideoStates;
}): VideoStateTarget => ({
  getVideoStates: () => mutableRendererData[LAYOUT_VIDEO_STATES_KEY],
  setVideoStates: (next) => {
    mutableRendererData[LAYOUT_VIDEO_STATES_KEY] = next;
  },
});

/**
 * Pass the renderer's Y.Map. Callers are expected to already be inside
 * `doc.transact()`
 */
export const yjsVideoStateTarget = (rendererData: {
  get: (key: any) => any;
  set: (key: any, value: any) => any;
}): VideoStateTarget => ({
  getVideoStates: () => {
    const raw = rendererData.get(LAYOUT_VIDEO_STATES_KEY);
    if (!raw) return undefined;
    // Y.Map when it came off the wire, plain object when we just wrote it.
    return typeof (raw as { toJSON?: unknown }).toJSON === "function"
      ? (raw as { toJSON: () => LayoutVideoStates }).toJSON()
      : (raw as LayoutVideoStates);
  },
  setVideoStates: (next) => {
    const YMap = rendererData.constructor as new () => {
      set: (key: string, value: unknown) => unknown;
    };
    const states = new YMap();
    for (const [key, state] of Object.entries(next)) {
      const entry = new YMap();
      for (const [field, value] of Object.entries(state)) {
        // Yjs can't hold undefined
        if (value !== undefined) entry.set(field, value);
      }
      states.set(key, entry);
    }
    rendererData.set(LAYOUT_VIDEO_STATES_KEY, states);
  },
});
