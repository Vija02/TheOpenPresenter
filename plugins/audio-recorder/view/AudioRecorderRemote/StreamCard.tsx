import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import { VscDebugStop, VscPlay } from "react-icons/vsc";

import { Stream } from "../../src";
import { pluginApi } from "../pluginApi";
import { UserNameTag } from "./AwarenessUser/UserNameTag";
import { getStreamState } from "../useAudioRecording";

type PropTypes = {
  activeStream: Stream;
};
export const StreamCard = ({ activeStream }: PropTypes) => {
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
      (x) => x.user.id === activeStream.awarenessUserId,
    );

    // If the user just disappeared, this object will be cleaned.
    // So just return null
    if (!currentAwarenessData) {
      return null;
    }

    const user = currentAwarenessData.user;

    const isRunning = recordings.some(
      (x) => x.streamId === activeStream.streamId && x.status !== "ended",
    );

    return (
      <Stack direction="row" border="1px solid" borderColor="gray.500" p={2}>
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
              });
            } else {
              getStreamState(activeStream.streamId!)?.stopRecording?.();
            }
          }}
        >
          {isRunning ? <VscDebugStop /> : <VscPlay />}
        </Button>
        <Stack gap={0}>
          <UserNameTag user={user} />
          <Text fontSize="sm" color="gray.600">
            {
              activeStream.availableSources.find(
                (x) => x.deviceId === activeStream.selectedDeviceId,
              )?.label
            }
          </Text>
        </Stack>
      </Stack>
    );
  }

  return (
    <Box bg="gray.200" p={2}>
      <Text fontWeight="bold">
        {activeStream.awarenessUserId}
        {activeStream.awarenessUserId === currentUserId ? " (This device)" : ""}
      </Text>
      <Text>Choose device to record</Text>
      {activeStream.availableSources.map((source) => (
        <Text
          key={source.deviceId}
          cursor="pointer"
          _hover={{ bg: "gray.300" }}
          onClick={() => {
            const index = mutableSceneData.pluginData.activeStreams.findIndex(
              (x) => x.streamId === activeStream.streamId,
            );
            mutableSceneData.pluginData.activeStreams[index]!.selectedDeviceId =
              source.deviceId;
          }}
        >
          - {source.label}
        </Text>
      ))}
    </Box>
  );
};

const WaitingForPermission = () => {
  return (
    <Flex
      minH="90px"
      alignItems="center"
      justifyContent="center"
      flexDir="column"
      border="1px solid"
      borderColor="gray.500"
    >
      <Text fontWeight="bold">Waiting for permission from device...</Text>
      <Text color="gray.600">
        Please allow microphone access in selected device
      </Text>
    </Flex>
  );
};
