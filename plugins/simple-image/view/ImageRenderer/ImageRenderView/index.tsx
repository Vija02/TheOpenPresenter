import { useEffect } from "react";

import { usePluginAPI } from "../../pluginApi";

const ImageRenderView = ({ src }: { src: string }) => {
  const pluginApi = usePluginAPI();
  const setAwarenessStateData = pluginApi.awareness.setAwarenessStateData;

  useEffect(() => {
    setAwarenessStateData({ isLoading: true });
  }, [setAwarenessStateData]);

  return (
    <img
      src={src}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
        background: "black",
      }}
      onLoad={() => {
        pluginApi.awareness.setAwarenessStateData({ isLoading: false });
      }}
    />
  );
};

export default ImageRenderView;
