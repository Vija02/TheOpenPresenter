import { useEffect, useMemo } from "react";

import { buildSlidoUrl } from "../../src/slido";
import { usePluginAPI } from "../pluginApi";

const Renderer = () => {
  const pluginApi = usePluginAPI();
  const setAwarenessStateData = pluginApi.awareness.setAwarenessStateData;

  const eventCode = pluginApi.scene.useData((x) => x.pluginData.eventCode);
  const section = pluginApi.scene.useData((x) => x.pluginData.section);

  const url = useMemo(
    () => (eventCode ? buildSlidoUrl({ eventCode, section }) : null),
    [eventCode, section],
  );

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
      style={{ height: "100%", width: "100%", border: 0 }}
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
      allowFullScreen={true}
      src={url}
      onLoad={() => {
        pluginApi.awareness.setAwarenessStateData({ isLoading: false });
      }}
    />
  );
};

export default Renderer;
