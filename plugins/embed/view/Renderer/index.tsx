import { useEffect } from "react";

import { usePluginAPI } from "../pluginApi";

const Renderer = () => {
  const pluginApi = usePluginAPI();
  const setAwarenessStateData = pluginApi.awareness.setAwarenessStateData;

  const url = pluginApi.scene.useData((x) => x.pluginData.url);

  useEffect(() => {
    if (url) {
      setAwarenessStateData({ isLoading: true });
    }
  }, [setAwarenessStateData, url]);

  if (!url) {
    return null;
  }

  return (
    <iframe
      style={{
        height: "100dvh",
        width: "100vw",
      }}
      sandbox="allow-scripts allow-same-origin allow-presentation"
      allowFullScreen={true}
      allowTransparency={true}
      src={url}
      onLoad={() => {
        pluginApi.awareness.setAwarenessStateData({ isLoading: false });
      }}
    />
  );
};

export default Renderer;
