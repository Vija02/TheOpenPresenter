import { Box } from "@chakra-ui/react";
import { useSnapshotPluginData } from "@repo/base-plugin/client";

import { MyWorshipListData } from "../../src/types";
import MWLLanding from "./MWLLanding";
import MWLRemoteCustom from "./MWLRemoteCustom";

const MWLRemote = () => {
  const d = useSnapshotPluginData<MyWorshipListData>();

  if (d.data.type === "unselected") {
    return <MWLLanding />;
  }

  if (d.data.type === "custom") {
    return <MWLRemoteCustom />;
  }

  return <Box p={3}>UNHANDLED</Box>;
};

export default MWLRemote;
