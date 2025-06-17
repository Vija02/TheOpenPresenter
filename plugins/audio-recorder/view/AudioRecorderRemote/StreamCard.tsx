import { Button } from "@repo/ui";
import { FaMicrophone } from "react-icons/fa";
import { VscDebugStop, VscPlay } from "react-icons/vsc";

import { Stream } from "../../src";
import { usePluginAPI } from "../pluginApi";
import { UserNameTag } from "./AwarenessUser/UserNameTag";
import { TimeSinceCreation } from "./TimeSinceCreation";

type PropTypes = {
  activeStream: Stream;
};
export const StreamCard = ({ activeStream }: PropTypes) => {
  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();
  const recordings = pluginApi.scene.useData((x) => x.pluginData.recordings);
  const currentUserId = pluginApi.awareness.currentUserId;
  const awarenessData = pluginApi.awareness.useAwarenessData();

  if (!activeStream.permissionGranted) {
    return <WaitingForPermission />;
  }

  if (activeStream.selectedDeviceId) {
    if (!activeStream.devicePermissionGranted || !activeStream.streamId) {
      return <WaitingForPermission />;
    }

    const currentAwarenessData = awarenessData.find(
      (x) => x.user?.id === activeStream.awarenessUserId,
    );

    // If the user just disappeared, this object will be cleaned.
    // So just return null
    if (!currentAwarenessData || !currentAwarenessData.user) {
      return null;
    }

    const user = currentAwarenessData.user;

    const foundRecording = recordings.find(
      (x) => x.streamId === activeStream.streamId && x.status !== "ended",
    );
    const isRunning = !!foundRecording;

    const onStop = () => {
      const index = mutableSceneData.pluginData.recordings.findIndex(
        (x) => x.streamId === activeStream.streamId && x.status !== "ended",
      );
      mutableSceneData.pluginData.recordings[index]!.status = "stopping";
    };

    return (
      <div className="stack-col items-stretch border border-stroke-emphasis p-2">
        <div className="stack-row items-start">
          <Button
            variant="ghost"
            onClick={() => {
              if (!isRunning) {
                mutableSceneData.pluginData.recordings.push({
                  streamId: activeStream.streamId!,
                  status: "pending",
                  mediaId: null,
                  startedAt: null,
                  endedAt: null,
                  isUploaded: false,
                });
              } else {
                onStop();
              }
            }}
          >
            {isRunning ? <VscDebugStop /> : <VscPlay />}
          </Button>
          <div className="flex flex-col">
            <UserNameTag user={user} />
            <p className="text-sm text-secondary">
              {
                activeStream.availableSources.find(
                  (x) => x.deviceId === activeStream.selectedDeviceId,
                )?.label
              }
            </p>
          </div>
        </div>
        {isRunning && (
          <div className="stack-row justify-between pt-2 border-t-1 border-stroke">
            <div className="stack-row">
              <FaMicrophone className="text-red-400 mx-2 size-6" />
              <div className="flex flex-col">
                <p className="font-bold">Recording on progress</p>
                <div className="stack-row items-stretch">
                  <p>Elapsed:</p>
                  <TimeSinceCreation
                    startedAt={foundRecording?.startedAt ?? new Date()}
                  />
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onStop();
              }}
            >
              <VscDebugStop />
              Stop
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-surface-secondary p-2">
      <p className="font-bold">
        {activeStream.awarenessUserId}
        {activeStream.awarenessUserId === currentUserId ? " (This device)" : ""}
      </p>
      <p>Choose device to record</p>
      {activeStream.availableSources.map((source) => (
        <p
          key={source.deviceId}
          className="cursor-pointer hover:bg-surface-secondary-hover"
          onClick={() => {
            const index = mutableSceneData.pluginData.activeStreams.findIndex(
              (x) => x.streamId === activeStream.streamId,
            );
            mutableSceneData.pluginData.activeStreams[index]!.selectedDeviceId =
              source.deviceId;
          }}
        >
          - {source.label}
        </p>
      ))}
    </div>
  );
};

const WaitingForPermission = () => {
  return (
    <div className="flex flex-col items-center justify-center border border-stroke text-center p-2 min-h-20">
      <p className="font-bold">Waiting for permission from device...</p>
      <p className="text-secondary">
        Please allow microphone access in selected device
      </p>
    </div>
  );
};
