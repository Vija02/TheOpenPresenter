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
    })),
  );

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
    const existing = current?.[video.key];

    next[video.key] = {
      // A fresh uid is what tells the player to seek rather than carry on
      uid: `${now}-${video.key}`,
      isPlaying: true,
      volume: existing?.volume ?? 1,
      muted: existing?.muted ?? false,
      seek: 0,
      startedAt: now,
      onFinishBehaviour: "pause",
    };
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

/** Pass the proxy from `pluginApi.renderer.useValtioData()` */
export const valtioVideoStateTarget = (mutableRendererData: {
  [LAYOUT_VIDEO_STATES_KEY]?: LayoutVideoStates;
}): VideoStateTarget => ({
  getVideoStates: () => mutableRendererData[LAYOUT_VIDEO_STATES_KEY],
  setVideoStates: (next) => {
    mutableRendererData[LAYOUT_VIDEO_STATES_KEY] = next;
  },
});

/** Callers are expected to already be inside `doc.transact()` */
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
    rendererData.set(LAYOUT_VIDEO_STATES_KEY, next);
  },
});
