import { Alert, Button } from "@repo/ui";
import { useState } from "react";

import { usePluginAPI } from "../pluginApi";
import { UserSourceSelector } from "./AwarenessUser/UserSourceSelector";
import { StreamCard } from "./StreamCard";

export const StreamSection = () => {
  const pluginApi = usePluginAPI();
  const activeStreams = pluginApi.scene.useData(
    (x) => x.pluginData.activeStreams,
  );

  const mutableSceneData = pluginApi.scene.useValtioData();

  if (activeStreams.length === 0) {
    return (
      <div>
        <Alert
          variant="info"
          title="No active stream."
          subtitle="Add one to start recording"
          size="sm"
          className="w-fit"
        />

        <div className="mb-2" />

        <UserSourceSelector
          onSelectUser={(userId) => {
            mutableSceneData.pluginData.activeStreams.push({
              awarenessUserId: userId,
              availableSources: [],
              permissionGranted: false,
              selectedDeviceId: null,
              devicePermissionGranted: false,
              streamId: null,
            });
          }}
        />
      </div>
    );
  }

  return (
    <>
      {activeStreams.map((activeStream, i) => (
        <StreamCard key={i} activeStream={activeStream} />
      ))}
      <AddNewStreams />
    </>
  );
};

const AddNewStreams = () => {
  const pluginApi = usePluginAPI();
  const [isAdding, setIsAdding] = useState(false);

  const mutableSceneData = pluginApi.scene.useValtioData();

  return (
    <div className="stack-col items-start">
      <Button onClick={() => setIsAdding(true)}>Add new stream</Button>
      {isAdding && (
        <>
          <UserSourceSelector
            onSelectUser={(userId) => {
              mutableSceneData.pluginData.activeStreams.push({
                awarenessUserId: userId,
                availableSources: [],
                permissionGranted: false,
                selectedDeviceId: null,
                devicePermissionGranted: false,
                streamId: null,
              });
              setIsAdding(false);
            }}
          />
        </>
      )}
    </div>
  );
};
