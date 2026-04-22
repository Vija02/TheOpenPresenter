import { usePluginAPI } from "../pluginApi";
import { GoogleSlideRenderer } from "./GoogleSlideRenderer";
import { ImageRenderer } from "./ImageRenderer";

const Renderer = () => {
  const pluginApi = usePluginAPI();
  const fetchId = pluginApi.scene.useData((x) => x.pluginData.fetchId);
  const type = pluginApi.scene.useData((x) => x.pluginData.type);
  const isFetching = pluginApi.scene.useData((x) => x.pluginData._isFetching);
  const displayMode = pluginApi.renderer.useData((x) => x.displayMode);

  // Don't render if no fetchId or if still fetching
  if (!fetchId || isFetching) {
    return null;
  }

  if (type === "pdf" || type === "ppt" || displayMode === "image") {
    return <ImageRenderer key={fetchId} />;
  }

  return <GoogleSlideRenderer key={fetchId} />;
};

export default Renderer;
