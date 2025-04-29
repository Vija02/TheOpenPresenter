import { usePluginAPI } from "../pluginApi";
import { GoogleSlideRenderer } from "./GoogleSlideRenderer";
import { ImageRenderer } from "./ImageRenderer";

const Renderer = ({
  shouldUpdateResolvedSlideIndex = false,
}: {
  shouldUpdateResolvedSlideIndex?: boolean;
}) => {
  const pluginApi = usePluginAPI();
  const fetchId = pluginApi.scene.useData((x) => x.pluginData.fetchId);
  const displayMode = pluginApi.renderer.useData((x) => x.displayMode);
  if (!fetchId) {
    return null;
  }

  if (displayMode === "image") {
    return <ImageRenderer key={fetchId} />;
  }

  return (
    <GoogleSlideRenderer
      key={fetchId}
      shouldUpdateResolvedSlideIndex={shouldUpdateResolvedSlideIndex}
    />
  );
};

export default Renderer;
