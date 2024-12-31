export type PluginBaseData = {
  recordings: Recording[];
  activeStreams: Stream[];
};

export type Recording = {
  /** The stream id that we will use to match to the stream */
  streamId: string;
  /**
   * pending -> waiting for the recording to start by the host
   * recording -> host currently recording
   * stopping -> stopping is triggered and waiting for it to be ended
   * ended -> recording ended
   */
  status: "pending" | "recording" | "stopping" | "ended";
  /** The ID of the media */
  mediaId: string | null;
  /** The time the recording was started */
  startedAt: string | null;
  /**
   * The time the recording was ended.
   * Note: This may not be accurate
   */
  endedAt: string | null;
  /** Whether the recording has finished uploading or not */
  isUploaded: boolean;
};

/**
 * Before a recording starts, we must get an active stream up and running.
 * The stream can originate from any user client (remote/renderer) and also of any of the media device.
 * The values below are populated in roughly the right order to communicate between the audio host and all the remote clients.
 *
 * Roughly, here is the sequence we need to follow:
 * 1. Pick the client/user
 * 2. Grant permission to allow fetching of device label
 * 3. Pick the device
 * 4. Grant permission on the device (optional - not necessary if we have granted it on step 2)
 *
 * At this point, we will have obtained the stream and populated it to `streamId`.
 * This stream is stored locally on the host client. And when a recording is started, we create a new entry in `Recording`.
 * The streamId will be used to match to the correct stream
 */
export type Stream = {
  /** The ID of the user based on awareness */
  awarenessUserId: string;
  /** Whether the user has granted permission for media */
  permissionGranted: boolean;
  /** The list of available media sources on the user */
  availableSources: {
    deviceId: string;
    label: string;
  }[];
  /** The specific device that should record */
  selectedDeviceId: string | null;
  /**
   * Indicate when we've gotten permission for the specific device.
   * This normally means that we've also acquired the stream
   */
  devicePermissionGranted: boolean;
  /**
   * The Stream ID that has been acquired through the stream
   */
  streamId: string | null;
};

export type PluginRendererData = {};
