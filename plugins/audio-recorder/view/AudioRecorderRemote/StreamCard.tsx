import { Box, Button, Flex, Stack, Text, chakra } from "@chakra-ui/react";
import { FaMicrophone as FaMicrophoneRaw } from "react-icons/fa";
import { VscDebugStop, VscPlay } from "react-icons/vsc";

import { Stream } from "../../src";
import { usePluginAPI } from "../pluginApi";
import { UserNameTag } from "./AwarenessUser/UserNameTag";
import { TimeSinceCreation } from "./TimeSinceCreation";

const FaMicrophone = chakra(FaMicrophoneRaw);

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
      <Stack direction="column" border="1px solid" borderColor="gray.500" p={2}>
        <Stack direction="row">
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
        {isRunning && (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            pt={2}
            borderTop="1px solid"
            borderColor="gray.400"
          >
            <Stack direction="row" alignItems="center">
              <FaMicrophone color="red.400" fontSize="xl" mx={2} />
              <Stack direction="column" gap={0}>
                <Text fontWeight="bold">Recording on progress</Text>
                <Stack direction="row">
                  <Text>Elapsed:</Text>
                  <TimeSinceCreation
                    startedAt={foundRecording?.startedAt ?? new Date()}
                  />
                </Stack>
              </Stack>
            </Stack>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onStop();
              }}
            >
              <VscDebugStop />
              <Text pl={2}>Stop</Text>
            </Button>
          </Stack>
        )}
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
      textAlign="center"
      p={2}
    >
      <Text fontWeight="bold">Waiting for permission from device...</Text>
      <Text color="gray.600">
        Please allow microphone access in selected device
      </Text>
    </Flex>
  );
};
