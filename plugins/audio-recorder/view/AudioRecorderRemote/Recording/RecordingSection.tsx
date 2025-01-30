import { Stack, Text } from "@chakra-ui/react";
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
      {endedRecordings.length === 0 && <Text>Nothing here yet.</Text>}
      <Stack direction="column" spacing={4}>
        {endedRecordings.map((recording) => (
          <RecordingCard key={recording.mediaId} recording={recording} />
        ))}
      </Stack>
    </>
  );
};
