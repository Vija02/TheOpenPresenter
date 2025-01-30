import { Box, Button, Stack, Text } from "@chakra-ui/react";
import { DateDisplay, PopConfirm } from "@repo/ui";
import WavesurferPlayer from "@wavesurfer/react";
import { useCallback, useMemo, useState } from "react";
import { FaPause, FaPlay } from "react-icons/fa6";
import { VscTrash } from "react-icons/vsc";
import WaveSurfer from "wavesurfer.js";
import Hover from "wavesurfer.js/dist/plugins/hover.esm.js";

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

  const [wavesurfer, setWavesurfer] = useState<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const onReady = useCallback((ws: WaveSurfer) => {
    setWavesurfer(ws);
    setIsPlaying(false);
  }, []);

  const onPlayPause = useCallback(() => {
    wavesurfer && wavesurfer.playPause();
  }, [wavesurfer]);

  const plugins = useMemo(
    () => [
      Hover.create({
        lineColor: "#ED672C",
        lineWidth: 2,
        labelBackground: "#555",
        labelColor: "#fff",
        labelSize: "11px",
      }),
    ],
    [],
  );

  if (!recording.isUploaded) {
    return <NotUploaded recording={recording} />;
  }

  return (
    <Stack direction="column">
      <Stack direction="row" justifyContent="space-between">
        <Stack direction="row" alignItems="center">
          <Button
            size="sm"
            onClick={onPlayPause}
            {...(isPlaying
              ? { bg: "black", color: "white", _hover: { bg: "gray.700" } }
              : { variant: "outline", colorScheme: "grey" })}
          >
            {!isPlaying ? <FaPlay /> : <FaPause />}
          </Button>
          <Text>
            Recording <DateDisplay date={new Date(recording.startedAt!)} />
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
      <Box w="100%">
        <WavesurferPlayer
          height={70}
          waveColor="#656666"
          progressColor="#ED672C"
          barWidth={2}
          url={pluginApi.media.getUrl(recording.mediaId + ".mp3")}
          onReady={onReady}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          plugins={plugins}
        />
      </Box>
    </Stack>
  );
};
