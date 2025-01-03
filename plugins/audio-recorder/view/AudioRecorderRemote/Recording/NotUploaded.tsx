import { Button, Stack, Text } from "@chakra-ui/react";
import { PopConfirm } from "@repo/ui";
import { useCallback } from "react";
import { VscTrash } from "react-icons/vsc";

import { Recording } from "../../../src";
import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";

export const NotUploaded = ({ recording }: { recording: Recording }) => {
  const pluginApi = usePluginAPI();

  const { mutateAsync: deleteAudio } =
    trpc.audioRecorder.deleteAudio.useMutation();

  const handleRemove = useCallback(() => {
    deleteAudio({
      mediaId: recording.mediaId!,
      pluginId: pluginApi.pluginContext.pluginId,
    });
  }, [deleteAudio, pluginApi.pluginContext.pluginId, recording.mediaId]);

  if (recording.streamUploadFailed) {
    return (
      <Stack
        direction="row"
        border="1px solid"
        borderColor="gray.500"
        p={2}
        justifyContent="space-between"
        alignItems="center"
      >
        <Stack gap={0}>
          <Text fontWeight="bold">
            Something went wrong with your recording
          </Text>
          <Text>
            Sorry, we are unable to do anything about this at the moment
          </Text>
        </Stack>
        <PopConfirm
          title={`Are you sure you want to remove this recording?`}
          onConfirm={handleRemove}
          okText="Yes"
          cancelText="No"
          key="remove"
        >
          <Button size="sm" variant="ghost" rounded="none">
            <VscTrash />
          </Button>
        </PopConfirm>
      </Stack>
    );
  }

  return (
    <Stack
      direction="row"
      border="1px solid"
      borderColor="gray.500"
      p={2}
      justifyContent="space-between"
      alignItems="center"
    >
      <Stack gap={0}>
        <Text fontWeight="bold">Your recording is being uploaded</Text>
        <Text>This should be done shortly</Text>
      </Stack>
      <PopConfirm
        title={`Are you sure you want to remove this recording?`}
        onConfirm={handleRemove}
        okText="Yes"
        cancelText="No"
        key="remove"
      >
        <Button size="sm" variant="ghost" rounded="none">
          <VscTrash />
        </Button>
      </PopConfirm>
    </Stack>
  );
};
