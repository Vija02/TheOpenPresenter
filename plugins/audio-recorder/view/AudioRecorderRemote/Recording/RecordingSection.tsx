import { useMemo } from "react";

import { usePluginAPI } from "../../pluginApi";
import { RecordingCard } from "./RecordingCard";

export const RecordingSection = () => {
  const pluginApi = usePluginAPI();
  const recordings = pluginApi.scene.useData((x) => x.pluginData.recordings);

  const endedRecordings = useMemo(
    () => recordings.filter((x) => x.status === "ended"),
    [recordings],
  );

  return (
    <>
      {endedRecordings.length === 0 && <p>Nothing here yet.</p>}
      <div className="stack-col items-stretch gap-4">
        {endedRecordings.map((recording) => (
          <RecordingCard key={recording.mediaId} recording={recording} />
        ))}
      </div>
    </>
  );
};
