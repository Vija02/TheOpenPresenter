import { Heading, Stack } from "@chakra-ui/react";
import { PluginScaffold } from "@repo/ui";

import { usePluginAPI } from "../pluginApi";
import { useAudioRecording } from "../useAudioRecording";
import { RecordingSection } from "./Recording/RecordingSection";
import { StreamSection } from "./StreamSection";

const AudioRecorderRemote = () => {
  // Handle audio recording always. We can record from remote. So this should always be rendered as long as the tab is open.
  useAudioRecording();

  const pluginApi = usePluginAPI();
  const pluginInView = pluginApi.remote.usePluginInView();
  if (!pluginInView) {
    return null;
  }

  return <AudioRecorderRemoteInner />;
};
const AudioRecorderRemoteInner = () => {
  return (
    <PluginScaffold
      title="Audio Recorder"
      body={
        <>
          <Stack dir="column" p={3} w="100%">
            <Heading>Streams</Heading>
            <StreamSection />
            <Heading as="h3" size="md">
              Recordings
            </Heading>
            <RecordingSection />
          </Stack>
        </>
      }
    />
  );
};

export default AudioRecorderRemote;
