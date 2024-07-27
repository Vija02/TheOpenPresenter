import { Box } from "@chakra-ui/react";

import { MyWorshipListData } from "../../src/types";
import { pluginApi } from "../util";
import MWLLanding from "./MWLLanding";
import MWLRemoteCustom from "./MWLRemoteCustom";

const MWLRemote = () => {
  const pluginData = pluginApi.scene.useData<MyWorshipListData>(
    (x) => x.pluginData,
  );

  if (pluginData.type === "unselected") {
    return <MWLLanding />;
  }

  if (pluginData.type === "custom") {
    return <MWLRemoteCustom />;
  }

  return <Box p={3}>UNHANDLED</Box>;
};

export default MWLRemote;
