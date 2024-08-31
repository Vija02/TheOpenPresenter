import { Box, Button, Tag, TagLabel, TagLeftIcon } from "@chakra-ui/react";
import { useState } from "react";
import { VscWarning } from "react-icons/vsc";

import { pluginApi } from "../pluginApi";
import { UserSourceSelector } from "./AwarenessUser/UserSourceSelector";
import { StreamCard } from "./StreamCard";

export const StreamSection = () => {
  const activeStreams = pluginApi.scene.useData(
    (x) => x.pluginData.activeStreams,
  );

  const mutableSceneData = pluginApi.scene.useValtioData();

  if (activeStreams.length === 0) {
    return (
      <Box>
        <Tag colorScheme="orange">
          <TagLeftIcon boxSize="12px" as={VscWarning} />
          <TagLabel>No active stream. Add one to start recording</TagLabel>
        </Tag>

        <Box mb={2} />

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
      </Box>
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
  const [isAdding, setIsAdding] = useState(false);

  const mutableSceneData = pluginApi.scene.useValtioData();

  return (
    <Box>
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
    </Box>
  );
};
