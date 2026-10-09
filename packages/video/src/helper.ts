import { perceptualToAmplitude } from "@discordapp/perceptual";

import { VideoPlaybackState } from "./types";

export const createVideoPlaybackState = (
  overrides?: Partial<VideoPlaybackState>,
): VideoPlaybackState => ({
  uid: Math.random().toString(),
  isPlaying: false,
  volume: 1,
  muted: false,
  seek: 0,
  startedAt: Date.now(),
  onFinishBehaviour: "pause",
  ...overrides,
});

// The quietest the curve goes before tapering off, in dB. Much past this,
// music on a room's speakers is inaudible, so the bottom of the slider would
// do nothing
const RANGE_DB = 35;
// Below this the curve tapers linearly to silence, rather than cutting out
// from -RANGE_DB at 0
const TAPER_BELOW = 0.1;

/**
 * Turns a volume slider value (0-1) into the amplitude players expect.
 */
export const volumeToAmplitude = (volume: number) => {
  const clamped = Math.min(Math.max(0, volume), 1);
  if (clamped >= TAPER_BELOW) {
    return perceptualToAmplitude(clamped, 1, RANGE_DB);
  }
  return (
    perceptualToAmplitude(TAPER_BELOW, 1, RANGE_DB) * (clamped / TAPER_BELOW)
  );
};
