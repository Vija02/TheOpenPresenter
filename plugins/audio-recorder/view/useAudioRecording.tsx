import { useEffect } from "react";
import * as tus from "tus-js-client";

import { OPFSStorageManager } from "./OPFSStorageManager";
import { usePluginAPI } from "./pluginApi";

// Stream ID -> Stream
// TODO: Capability to stop stream
const streamManager: Record<string, MediaStream> = {};
// Media ID -> Recorder, etc
const recorderManager: Record<
  string,
  {
    streamId: string;
    recorder: MediaRecorder | null;
    chunks: any[];
    done: boolean;
    onDataAvailable: ((data: any) => void) | null | undefined;
    stopRecording: (() => void) | null;
  }
> = {};

// TODO: Store locally and upload when available when offline
// TODO: Handle error better
// Note: Recording should continue running even when we're viewing different plugins. Applies to renderer too
export const useAudioRecording = () => {
  const pluginApi = usePluginAPI();
  const currentUserId = pluginApi.awareness.currentUserId;

  const mutableSceneData = pluginApi.scene.useValtioData();
  const activeStreams = pluginApi.scene.useData(
    (x) => x.pluginData.activeStreams,
  );
  const recordings = pluginApi.scene.useData((x) => x.pluginData.recordings);

  useEffect(() => {
    activeStreams.forEach((activeStream, i) => {
      if (activeStream.awarenessUserId !== currentUserId) {
        return;
      }

      // Handle initial permission
      if (!activeStream.permissionGranted) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
          navigator.mediaDevices.enumerateDevices().then((devices) => {
            const availableSources = devices
              .filter((x) => x.kind === "audioinput")
              .map((x) => ({
                deviceId: x.deviceId,
                label: x.label,
              }));

            mutableSceneData.pluginData.activeStreams[i]!.permissionGranted =
              true;
            mutableSceneData.pluginData.activeStreams[i]!.availableSources =
              availableSources;
          });
        });
      }

      // Handle getting stream of the device
      if (
        activeStream.permissionGranted &&
        !!activeStream.selectedDeviceId &&
        !activeStream.devicePermissionGranted
      ) {
        navigator.mediaDevices
          .getUserMedia({
            audio: { deviceId: { exact: activeStream.selectedDeviceId } },
          })
          .then((stream) => {
            mutableSceneData.pluginData.activeStreams[
              i
            ]!.devicePermissionGranted = true;

            mutableSceneData.pluginData.activeStreams[i]!.streamId = stream.id;

            streamManager[stream.id] = stream;
          });
      }
    });
  }, [activeStreams, currentUserId, mutableSceneData.pluginData.activeStreams]);

  useEffect(() => {
    // For each recording
    recordings.forEach((recording, i) => {
      const availableLocalStreamIds = Object.keys(streamManager);
      // Only handle if the stream is in this tab
      if (availableLocalStreamIds.includes(recording.streamId)) {
        // In the beginning, let's create the recording if it doesn't exist yet
        if (mutableSceneData.pluginData.recordings[i]?.mediaId === null) {
          const mediaId = pluginApi.media.generateId();

          const mediaRecorder = new MediaRecorder(
            streamManager[recording.streamId]!,
          );

          recorderManager[mediaId] = {
            streamId: recording.streamId,
            recorder: mediaRecorder,
            chunks: [],
            done: false,
            onDataAvailable: null,
            stopRecording: null,
          };

          mutableSceneData.pluginData.recordings[i]!.mediaId = mediaId;
          mutableSceneData.pluginData.recordings[i]!.status = "recording";
          mutableSceneData.pluginData.recordings[i]!.startedAt =
            new Date().toISOString();

          // Now let's start uploading
          startStreamUpload({
            pluginApi,
            mediaId,
            onStopRecording: () => {
              mutableSceneData.pluginData.recordings[i]!.status = "ended";
              mutableSceneData.pluginData.recordings[i]!.endedAt =
                new Date().toISOString();
            },
            onUploaded: () => {
              mutableSceneData.pluginData.recordings[i]!.isUploaded = true;
            },
            onError: () => {
              mutableSceneData.pluginData.recordings[i]!.streamUploadFailed =
                true;
            },
          });
        }

        // Stop if stopping
        if (mutableSceneData.pluginData.recordings[i]!.status === "stopping") {
          recorderManager[
            mutableSceneData.pluginData.recordings[i]!.mediaId!
          ]?.stopRecording?.();
        }
      }
    });
  }, [mutableSceneData.pluginData.recordings, pluginApi, recordings]);
};

// Much of the code here is inspired from
// https://github.com/tus/tus-js-client/blob/main/demos/browser/video.js
async function startStreamUpload({
  pluginApi,
  mediaId,
  onStopRecording,
  onUploaded,
  onError,
}: {
  pluginApi: ReturnType<typeof usePluginAPI>;
  mediaId: string;
  onStopRecording: () => void;
  onUploaded: () => void;
  onError: () => void;
}) {
  const storageManager = new OPFSStorageManager();
  const recordingInstance = recorderManager[mediaId]!;
  const mediaRecorder = recordingInstance.recorder!;

  const fileName = `${mediaId}.mp3`;
  const fileHandle = await storageManager.getFileHandle(fileName);

  mediaRecorder.onerror = (err) => {
    console.error(err);
    pluginApi.remote.toast(`Audio Recorder: Failed to record. Error: ${err}`, {
      toastId: "audio-recorder--mediaRecorderError",
    });

    // reset()
  };
  mediaRecorder.onstop = () => {
    recordingInstance.done = true;
    if (recordingInstance.onDataAvailable) {
      recordingInstance.onDataAvailable(readableRecorder.read());
    }
  };
  mediaRecorder.ondataavailable = async (event) => {
    recordingInstance.chunks.push(event.data);
    if (recordingInstance.onDataAvailable) {
      recordingInstance.onDataAvailable(readableRecorder.read());
      recordingInstance.onDataAvailable = undefined;
    }

    if (fileHandle) {
      storageManager.writeFile(fileHandle, {
        data: event.data,
        shouldAppend: true,
      });
    }
  };

  mediaRecorder.start(1000);

  const readableRecorder = {
    read() {
      if (recordingInstance.done && recordingInstance.chunks.length === 0) {
        return Promise.resolve({ done: true });
      }

      if (recordingInstance.chunks.length > 0) {
        return Promise.resolve({
          value: recordingInstance.chunks.shift(),
          done: false,
        });
      }

      return new Promise((resolve) => {
        recordingInstance.onDataAvailable = resolve;
      });
    },
  };

  startUpload(pluginApi, readableRecorder, {
    mediaId,
    onSuccess: () => {
      onUploaded();
      // Remove cache if already successfully uploaded
      // TODO: Remove on manual upload
      storageManager.removeFile(fileName);
    },
    onError,
  });

  recordingInstance.stopRecording = () => {
    onStopRecording();
    mediaRecorder.stop();
    delete recorderManager[mediaId];
  };
}

function startUpload(
  pluginApi: ReturnType<typeof usePluginAPI>,
  file: any,
  {
    mediaId,
    onSuccess,
    onError,
  }: {
    mediaId: string;
    onSuccess: () => void;
    onError: (err: Error | tus.DetailedError) => void;
  },
) {
  const endpoint = pluginApi.media.tusUploadUrl;
  // DEBT: Maybe need bigger chunkSize
  const chunkSize = 15000; // 15kb. Roughly every second

  const options: tus.UploadOptions = {
    endpoint,
    chunkSize,
    retryDelays: [0, 1000, 3000, 5000],
    uploadLengthDeferred: true,
    headers: {
      "csrf-token": pluginApi.env.getCSRFToken(),
      "organization-id": pluginApi.pluginContext.organizationId,
      "file-extension": "mp3",
      "custom-media-id": mediaId,
    },
    metadata: {
      filename: `recording_${new Date().toISOString()}.mp3`,
    },
    onError(error) {
      onError(error);
      // TODO: Set state
      if ("originalRequest" in error) {
        // TODO: Better error handling
        pluginApi.remote.toast.warning(
          `Audio Recorder: Failed to upload video. Retrying... Error: ${error.message}`,
          { toastId: "audio-recorder--uploadError-originalRequest" },
        );
      } else {
        pluginApi.remote.toast.error(
          `Audio Recorder: Failed to upload video. Error: ${error.message}`,
          { toastId: "audio-recorder--uploadError-no-originalRequest" },
        );
      }

      // reset()
    },
    onSuccess,
  };

  const upload = new tus.Upload(file, options);
  upload.start();
}
