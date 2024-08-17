import { Box, Button, Text } from "@chakra-ui/react";
import { useCallback } from "react";

import { CustomTypeData } from "../../src/types";
import { pluginApi } from "../util";

const MWLLanding = () => {
  const sceneData = pluginApi.scene.useValtioData();

  const onCustom = useCallback(() => {
    sceneData.pluginData.type = "custom";
    (sceneData.pluginData as CustomTypeData).songCache = [];
    (sceneData.pluginData as CustomTypeData).songIds = [];
  }, [sceneData]);

  return (
    <Box>
      <Text>Landing</Text>
      <Button onClick={onCustom}>Set Custom Type</Button>
    </Box>
  );
};
export default MWLLanding;
