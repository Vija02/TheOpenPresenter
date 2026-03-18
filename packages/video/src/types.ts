/**
 * Base video type
 */
export type Video = {
  id: string;
  /** The fallback/primary url to play for any video */
  url: string;
  isInternalVideo?: boolean;
  metadata: VideoMetadata;
};
export type VideoMetadata = {
  title?: string;
  /** Duration in seconds */
  duration?: number;
  thumbnailUrl?: string;
};

export type InternalVideo = Video & {
  isInternalVideo: true;
  /** When populated, we should play HLS */
  hlsMediaName: string | null;
  thumbnailMediaName: string | null;
};

export type UniversalVideo = Video | InternalVideo;

/**
 * The complete playback state for a single video.
 * This contains everything needed to play and control a video.
 * Store this in your Yjs state and pass it to VideoPlayer.
 */
export type VideoPlaybackState = {
  /**
   * Unique ID for the current playback session.
   * Update this when seeking to force the player to sync.
   */
  uid: string;
  isPlaying: boolean;
  volume: number;
  muted?: boolean;
  /** Current seek position as a fraction (0 to 1) */
  seek: number;
  startedAt: number;
  onFinishBehaviour: "pause" | "loop";
};
