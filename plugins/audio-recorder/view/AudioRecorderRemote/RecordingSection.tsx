import { Box, Button, Stack, Text } from "@chakra-ui/react";
import { PopConfirm } from "@repo/ui";
import { addSeconds, formatDuration, intervalToDuration } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import { VscTrash } from "react-icons/vsc";
import { useElapsedTime } from "use-elapsed-time";

import { Recording } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import { trpc } from "../trpc";

export const RecordingSection = () => {
  const pluginApi = usePluginAPI();
  const recordings = pluginApi.scene.useData((x) => x.pluginData.recordings);

  return (
    <>
      {recordings.map((recording) => (
        <RecordingCard key={recording.mediaId} recording={recording} />
      ))}
    </>
  );
};

const RecordingCard = ({ recording }: { recording: Recording }) => {
  return (
    <Box>
      {recording.status === "recording" && (
        <CurrentlyRecording recording={recording} />
      )}
      {recording.status === "ended" && <RecordingEnded recording={recording} />}
    </Box>
  );
};

const CurrentlyRecording = ({ recording }: { recording: Recording }) => {
  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();

  return (
    <Box>
      <Button
        onClick={() => {
          const index = mutableSceneData.pluginData.recordings.findIndex(
            (x) => x.streamId === recording.streamId && x.status !== "ended",
          );
          mutableSceneData.pluginData.recordings[index]!.status = "stopping";
        }}
      >
        Stop Recording
      </Button>
      <TimeSinceCreation startedAt={recording.startedAt ?? new Date()} />
    </Box>
  );
};

const RecordingEnded = ({ recording }: { recording: Recording }) => {
  const pluginApi = usePluginAPI();

  const { mutateAsync: deleteAudio } =
    trpc.audioRecorder.deleteAudio.useMutation();

  const handleRemove = useCallback(() => {
    deleteAudio({
      mediaId: recording.mediaId!,
      pluginId: pluginApi.pluginContext.pluginId,
    });
  }, [deleteAudio, pluginApi.pluginContext.pluginId, recording.mediaId]);

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

const TimeSinceCreation = ({ startedAt }: { startedAt: string | Date }) => {
  const { elapsedTime } = useElapsedTime({
    updateInterval: 1,
    isPlaying: true,
  });

  const [now] = useState(new Date());

  const duration = useMemo(
    () =>
      intervalToDuration({
        start: startedAt,
        end: addSeconds(now, elapsedTime),
      }),
    [elapsedTime, now, startedAt],
  );

  return (
    <>
      <Text>{formatDuration(duration)}</Text>
    </>
  );
};
