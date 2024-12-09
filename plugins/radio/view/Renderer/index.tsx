import { lazy } from "react";

import { usePluginAPI } from "../pluginApi";

const Player = lazy(() => import("./Player"));

const RadioRenderer = () => {
  const pluginApi = usePluginAPI();
  const isPlaying = pluginApi.renderer.useData((x) => x.isPlaying);
  const url = pluginApi.renderer.useData((x) => x.url);

  const canPlay = pluginApi.audio.useCanPlay({ skipCheck: !isPlaying });

  if (!canPlay || !url) {
    return null;
  }
  return <Player key={url} />;
};

export default RadioRenderer;
