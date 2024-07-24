import { Box, Button, Text } from "@chakra-ui/react";
import { useCallback } from "react";

import { CustomData } from "../../src/types";
import { useValtioSceneData } from "../util";

const MWLLanding = () => {
  const sceneData = useValtioSceneData();

  const onCustom = useCallback(() => {
    sceneData.data.type = "custom";
    (sceneData.data as CustomData).songCache = [];
    (sceneData.data as CustomData).songIds = [];
  }, [sceneData]);

  return (
    <Box>
      <Text>Landing</Text>
      <Button onClick={onCustom}>Set Custom Type</Button>
    </Box>
  );
};
export default MWLLanding;
