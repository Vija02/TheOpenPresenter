import { PluginRendererState } from "@repo/base-plugin";
import { VideoMetadata, VideoPlaybackState } from "@repo/video";

import type { SequenceOutgoing, SequenceRepeat } from "./sequence";

export type TrackMetadata = VideoMetadata & {
  author?: string;
};

export type YoutubeTrack = {
  id: string;
  type: "youtube";
  url: string;
  metadata: TrackMetadata;
};

// DEBT: Add "audio" tracks once the media system supports audio files
export type Track = YoutubeTrack;

export type RepeatMode = SequenceRepeat;

export type PluginBaseData = {
  /** Unused. Kept from when this was the radio plugin */
  url: string;
  tracks: Track[];
};

export type PluginRendererData = PluginRendererState & {
  // URL for Radio
  url: string | null;
  isPlaying: boolean;
  volume: number;

  activeTrackId: string | null;
  trackState: VideoPlaybackState;
  repeatMode: RepeatMode;
  /** 0 is off */
  crossfadeSeconds: number;
  /** The anchor's `outgoing`, see ./sequence */
  fadingOutTrack: SequenceOutgoing | null;
};
