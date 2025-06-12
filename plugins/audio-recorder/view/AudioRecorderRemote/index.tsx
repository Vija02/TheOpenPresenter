import { PluginScaffold } from "@repo/ui";

import { usePluginAPI } from "../pluginApi";
import { useAudioRecording } from "../useAudioRecording";
import { RecordingSection } from "./Recording/RecordingSection";
import { StreamSection } from "./StreamSection";
import "./index.css";

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
          <div className="stack-col items-stretch p-3 w-full">
            <h2 className="text-xl font-bold">Streams</h2>
            <StreamSection />
            <h3 className="text-lg font-bold">Recordings</h3>
            <RecordingSection />
          </div>
        </>
      }
    />
  );
};

export default AudioRecorderRemote;
