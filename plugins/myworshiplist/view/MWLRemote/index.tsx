import { Box } from "@chakra-ui/react";

import { MyWorshipListData } from "../../src/types";
import { useValtioSceneData } from "../util";
import MWLLanding from "./MWLLanding";
import MWLRemoteCustom from "./MWLRemoteCustom";

const MWLRemote = () => {
  const sceneData = useValtioSceneData<MyWorshipListData>();

  if (sceneData.data.type === "unselected") {
    return <MWLLanding />;
  }

  if (sceneData.data.type === "custom") {
    return <MWLRemoteCustom />;
  }

  return <Box p={3}>UNHANDLED</Box>;
};

export default MWLRemote;
