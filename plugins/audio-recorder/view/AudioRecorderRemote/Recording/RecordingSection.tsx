import { usePluginAPI } from "../../pluginApi";
import { RecordingCard } from "./RecordingCard";

export const RecordingSection = () => {
  const pluginApi = usePluginAPI();
  const recordings = pluginApi.scene.useData((x) => x.pluginData.recordings);

  return (
    <>
      {recordings
        .filter((x) => x.status === "ended")
        .map((recording) => (
          <RecordingCard key={recording.mediaId} recording={recording} />
        ))}
    </>
  );
};
