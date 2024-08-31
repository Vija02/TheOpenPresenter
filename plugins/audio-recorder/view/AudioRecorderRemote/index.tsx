import { Heading, Stack } from "@chakra-ui/react";

import { RecordingSection } from "./RecordingSection";
import { StreamSection } from "./StreamSection";
import { useAudioRecording } from "../useAudioRecording";

const AudioRecorderRemote = () => {
  useAudioRecording();

  return (
    <Stack dir="column" p={3}>
      <Heading>Streams</Heading>

      <StreamSection />

      <Heading as="h3" size="md">
        Current Recordings
      </Heading>

      <RecordingSection />
    </Stack>
  );
};

export default AudioRecorderRemote;
