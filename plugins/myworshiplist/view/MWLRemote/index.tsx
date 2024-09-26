import { usePluginAPI } from "../pluginApi";
import MWLLanding from "./MWLLanding";
import MWLRemote from "./MWLRemote";

const MWLRemoteIndex = () => {
  const pluginApi = usePluginAPI();
  const songs = pluginApi.scene.useData((x) => x.pluginData.songs);

  if (songs.length === 0) {
    return <MWLLanding />;
  }

  return <MWLRemote />;
};

export default MWLRemoteIndex;
