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
