import { Box } from "@chakra-ui/react";

import { MyWorshipListData } from "../../src/types";
import { useSceneData } from "../util";
import MWLLanding from "./MWLLanding";
import MWLRemoteCustom from "./MWLRemoteCustom";

const MWLRemote = () => {
  const pluginData = useSceneData<MyWorshipListData>((x) => x.data);

  if (pluginData.type === "unselected") {
    return <MWLLanding />;
  }

  if (pluginData.type === "custom") {
    return <MWLRemoteCustom />;
  }

  return <Box p={3}>UNHANDLED</Box>;
};

export default MWLRemote;
