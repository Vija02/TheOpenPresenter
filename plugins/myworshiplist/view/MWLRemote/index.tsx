import { Box } from "@chakra-ui/react";

import { MyWorshipListData } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import MWLLanding from "./MWLLanding";
import MWLRemoteCustom from "./MWLRemoteCustom";
import MWLRemoteFullSong from "./MWLRemoteFullSong";

const MWLRemote = () => {
  const pluginApi = usePluginAPI();
  const pluginData = pluginApi.scene.useData<MyWorshipListData>(
    (x) => x.pluginData,
  );

  if (pluginData.type === "unselected") {
    return <MWLLanding />;
  }

  if (pluginData.type === "custom") {
    return <MWLRemoteCustom />;
  }

  if (pluginData.type === "fullsong") {
    return <MWLRemoteFullSong />;
  }

  return <Box p={3}>UNHANDLED</Box>;
};

export default MWLRemote;
