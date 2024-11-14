import { usePluginAPI } from "../pluginApi";
import Landing from "./Landing";
import Remote from "./Remote";
import "./index.css";

const RemoteIndex = () => {
  const pluginApi = usePluginAPI();
  const songs = pluginApi.scene.useData((x) => x.pluginData.songs);

  if (songs.length === 0) {
    return <Landing />;
  }

  return <Remote />;
};

export default RemoteIndex;
