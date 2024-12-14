import { useEffect } from "react";
import * as tus from "tus-js-client";
import { proxy, useSnapshot } from "valtio";

import { usePluginAPI } from "./pluginApi";

const streamState: Record<
  string,
  {
    stream: MediaStream;
    recorder: MediaRecorder | null;
    chunks: any[];
    done: boolean;
    onDataAvailable: ((data: any) => void) | null | undefined;
    stopRecording: (() => void) | null;
  }
> = {};

// TODO: Store locally and upload when available when offline
// TODO: Allow streams to be reused
// TODO: Handle error better
// Note: Recording should continue running even when we're viewing different plugins. Applies to renderer too
// DEBT: Maybe make a test for this
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

            streamState[stream.id] = {
              stream,
              recorder: null,
              chunks: [],
              done: false,
              onDataAvailable: null,
              stopRecording: null,
            };
          });
      }
    });
  }, [activeStreams, currentUserId, mutableSceneData.pluginData.activeStreams]);

  useEffect(() => {
    recordings.forEach((recording, i) => {
      const availableLocalStreamIds = Object.keys(streamState);
      if (availableLocalStreamIds.includes(recording.streamId)) {
        const localStreamData = streamState[recording.streamId]!;

        // Stop if stopping
        if (mutableSceneData.pluginData.recordings[i]!.status === "stopping") {
          localStreamData.stopRecording?.();
          return;
        }
        // Skip if we're already recording
        if (localStreamData.recorder) {
          return;
        }

        const mediaRecorder = new MediaRecorder(localStreamData.stream);

        localStreamData.recorder = mediaRecorder;

        // Now let's handle the recording
        const mediaId = pluginApi.media.generateId();

        startStreamUpload({
          pluginApi,
          mediaRecorder,
          currentStreamState: localStreamData,
          mediaId,
          onStopRecording: () => {
            mutableSceneData.pluginData.recordings[i]!.status = "ended";
            mutableSceneData.pluginData.recordings[i]!.endedAt =
              new Date().toISOString();
          },
        });

        mutableSceneData.pluginData.recordings[i]!.mediaId = mediaId;
        mutableSceneData.pluginData.recordings[i]!.status = "recording";
        mutableSceneData.pluginData.recordings[i]!.startedAt =
          new Date().toISOString();
      }
    });
  }, [mutableSceneData.pluginData.recordings, pluginApi, recordings]);
};

export const useStreamState = (streamId: string) => {
  return useSnapshot(proxy(streamState))[streamId];
};

// Much of the code here is inspired from
// https://github.com/tus/tus-js-client/blob/main/demos/browser/video.js
function startStreamUpload({
  pluginApi,
  mediaRecorder,
  currentStreamState,
  mediaId,
  onStopRecording,
}: {
  pluginApi: ReturnType<typeof usePluginAPI>;
  mediaRecorder: MediaRecorder;
  currentStreamState: (typeof streamState)[string];
  mediaId: string;
  onStopRecording: () => void;
}) {
  mediaRecorder.onerror = (err) => {
    console.error(err);
    pluginApi.remote.toast(`Audio Recorder: Failed to record. Error: ${err}`);

    // reset()
  };
  mediaRecorder.onstop = () => {
    currentStreamState.done = true;
    if (currentStreamState.onDataAvailable) {
      currentStreamState.onDataAvailable(readableRecorder.read());
    }
  };
  mediaRecorder.ondataavailable = (event) => {
    currentStreamState.chunks.push(event.data);
    if (currentStreamState.onDataAvailable) {
      currentStreamState.onDataAvailable(readableRecorder.read());
      currentStreamState.onDataAvailable = undefined;
    }
  };

  mediaRecorder.start(1000);

  const readableRecorder = {
    read() {
      if (currentStreamState.done && currentStreamState.chunks.length === 0) {
        return Promise.resolve({ done: true });
      }

      if (currentStreamState.chunks.length > 0) {
        return Promise.resolve({
          value: currentStreamState.chunks.shift(),
          done: false,
        });
      }

      return new Promise((resolve) => {
        currentStreamState.onDataAvailable = resolve;
      });
    },
  };

  startUpload(pluginApi, readableRecorder, mediaId);

  currentStreamState.stopRecording = () => {
    for (const track of currentStreamState.stream.getTracks()) {
      track.stop();
    }
    onStopRecording();
    mediaRecorder.stop();
    currentStreamState.stopRecording = null;
  };
}

function startUpload(
  pluginApi: ReturnType<typeof usePluginAPI>,
  file: any,
  mediaId: string,
) {
  const endpoint = pluginApi.media.tusUploadUrl;
  const chunkSize = 15000; // 15kb. Roughly every second

  const options: tus.UploadOptions = {
    endpoint,
    chunkSize,
    retryDelays: [0, 1000, 3000, 5000],
    uploadLengthDeferred: true,
    headers: {
      "csrf-token": pluginApi.env.getCSRFToken(),
    },
    metadata: {
      id: mediaId,
      extension: "mp3",
      organizationId: pluginApi.pluginContext.organizationId,
    },
    onError(error) {
      if ("originalRequest" in error) {
        pluginApi.remote.toast.warning(
          `Audio Recorder: Failed to upload video. Retrying... Error: ${error.message}`,
        );
        upload.start();
      } else {
        pluginApi.remote.toast.error(
          `Audio Recorder: Failed to upload video. Error: ${error.message}`,
        );
      }

      // reset()
    },
  };

  const upload = new tus.Upload(file, options);
  upload.start();
}
