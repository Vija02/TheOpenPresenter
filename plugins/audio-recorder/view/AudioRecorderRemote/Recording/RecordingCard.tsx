import { Button, Stack } from "@chakra-ui/react";
import { PopConfirm } from "@repo/ui";
import { useCallback } from "react";
import { VscTrash } from "react-icons/vsc";

import { Recording } from "../../../src";
import { usePluginAPI } from "../../pluginApi";
import { trpc } from "../../trpc";
import { NotUploaded } from "./NotUploaded";

export const RecordingCard = ({ recording }: { recording: Recording }) => {
  const pluginApi = usePluginAPI();

  const { mutateAsync: deleteAudio } =
    trpc.audioRecorder.deleteAudio.useMutation();

  const handleRemove = useCallback(() => {
    deleteAudio({
      mediaId: recording.mediaId!,
      pluginId: pluginApi.pluginContext.pluginId,
    });
  }, [deleteAudio, pluginApi.pluginContext.pluginId, recording.mediaId]);

  if (!recording.isUploaded) {
    return <NotUploaded recording={recording} />;
  }

  return (
    <Stack direction="row">
      <audio
        controls
        preload="metadata"
        src={pluginApi.media.getUrl(recording.mediaId + ".mp3")}
      ></audio>
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
