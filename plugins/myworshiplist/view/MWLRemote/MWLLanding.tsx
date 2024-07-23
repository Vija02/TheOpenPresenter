import { Box, Button, Text } from "@chakra-ui/react";
import { useMutablePluginData } from "@repo/base-plugin/client";
import { useCallback } from "react";

import { CustomData, MyWorshipListData } from "../../src/types";

const MWLLanding = () => {
  const mutableData = useMutablePluginData<MyWorshipListData>();

  const onCustom = useCallback(() => {
    mutableData.data.type = "custom";
    (mutableData.data as CustomData).songCache = [];
    (mutableData.data as CustomData).songIds = [];
  }, [mutableData]);

  return (
    <Box>
      <Text>Landing</Text>
      <Button onClick={onCustom}>Set Custom Type</Button>
    </Box>
  );
};
export default MWLLanding;
