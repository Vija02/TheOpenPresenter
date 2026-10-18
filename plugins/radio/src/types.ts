import { PluginRendererState } from "@repo/base-plugin";
import {
  SequenceOutgoing,
  SequenceRepeat,
  VideoMetadata,
  VideoPlaybackState,
} from "@repo/video";

export type TrackMetadata = VideoMetadata & {
  author?: string;
};

export type YoutubeTrack = {
  id: string;
  type: "youtube";
  url: string;
  metadata: TrackMetadata;
};

/** From the media library. Names rather than urls, since hosts differ */
export type AudioTrack = {
  id: string;
  type: "audio";
  mediaName: string;
  /** Null while the library is still processing it */
  playbackMediaName: string | null;
  coverMediaName: string | null;
  metadata: TrackMetadata;
};

export type Track = YoutubeTrack | AudioTrack;

export type RepeatMode = SequenceRepeat;

export type PluginBaseData = {
  /** Unused. Kept from when this was the radio plugin */
  url: string;
  tracks: Track[];
  /** The saved playlist this was loaded from or saved as */
  savedPlaylistId?: string | null;
};

export type PluginRendererData = PluginRendererState & {
  // URL for Radio
  url: string | null;
  isPlaying: boolean;
  volume: number;

  activeTrackId: string | null;
  trackState: VideoPlaybackState;
  repeatMode: RepeatMode;
  autoplay?: boolean;
  /** 0 is off */
  crossfadeSeconds: number;
  /** The anchor's `outgoing`, see ./sequence */
  fadingOutTrack: SequenceOutgoing | null;
};

/** An organization's playlist, reusable across scenes */
export type SavedPlaylist = {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: string;
  updatedAt: string;
};
