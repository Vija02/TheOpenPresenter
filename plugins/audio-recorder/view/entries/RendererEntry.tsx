import { PluginAPIProvider, WebComponentProps } from "@repo/base-plugin/client";

import { useAudioRecording } from "../useAudioRecording";

export default function RendererEntry(props: WebComponentProps<any>) {
  return (
    <PluginAPIProvider {...props}>
      <AudioHandler />
    </PluginAPIProvider>
  );
}

const AudioHandler = () => {
  useAudioRecording();
  return null;
};
