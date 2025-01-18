import { Box, Button, Stack, Text } from "@chakra-ui/react";
import { AwarenessStore } from "@repo/base-plugin/client";
import { PopConfirm } from "@repo/ui";
import { useCallback, useMemo } from "react";
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
      <StreamUploadFailed recording={recording} handleRemove={handleRemove} />
    );
  }

  return <StreamUploading handleRemove={handleRemove} />;
};

const StreamUploadFailed = ({
  recording,
  handleRemove,
}: {
  recording: Recording;
  handleRemove: () => void;
}) => {
  const pluginApi = usePluginAPI();

  const mutableSceneData = pluginApi.scene.useValtioData();

  // Check awareness for whoever holds the data for this recording
  const awareness = pluginApi.awareness.useAwarenessData();
  const availableMedias = useMemo(
    () =>
      awareness
        .map((x: AwarenessStore<Record<string, any>>) => ({
          awarenessUserId: x.user.id,
          media: x?.[pluginApi.pluginContext.pluginId]?.availableMedias ?? [],
        }))
        .filter((x) => !!x),
    [awareness, pluginApi.pluginContext.pluginId],
  );

  const flattened = useMemo(
    () =>
      availableMedias
        .map((media) =>
          media.media.map((x: any) => ({
            ...x,
            awarenessUserId: media.awarenessUserId,
          })),
        )
        .flat(),
    [availableMedias],
  );
  const foundIndex = useMemo(
    () => flattened.findIndex((x) => x.name === `${recording.mediaId}.mp3`),
    [flattened, recording.mediaId],
  );

  const onUpload = useCallback(() => {
    const index = mutableSceneData.pluginData.recordings.findIndex(
      (x) => x.mediaId === recording.mediaId,
    );
    mutableSceneData.pluginData.recordings[index]!.awarenessUserToRetry =
      flattened[foundIndex].awarenessUserId;
  }, [
    flattened,
    foundIndex,
    mutableSceneData.pluginData.recordings,
    recording.mediaId,
  ]);

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
          Your recording has not been successfully uploaded
        </Text>
        {foundIndex > -1 && (
          <Button onClick={onUpload} mt={2} size="sm" colorScheme="primary">
            Upload
          </Button>
        )}
        {foundIndex === -1 && (
          <Box>
            <Text>
              To reupload, open the device that the audio was recorded in
            </Text>
          </Box>
        )}
        <Text>{recording.awarenessUserToRetry}</Text>
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

const StreamUploading = ({ handleRemove }: { handleRemove: () => void }) => {
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
