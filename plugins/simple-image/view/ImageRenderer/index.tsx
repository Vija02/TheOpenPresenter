import { useMemo } from "react";

import { usePluginAPI } from "../pluginApi";
import ImageRenderView from "./ImageRenderView";

const ImageRenderer = () => {
  const pluginApi = usePluginAPI();
  const data = pluginApi.renderer.useData((x) => x);
  const imgIndex = data.imgIndex;

  const images = pluginApi.scene.useData((x) => x.pluginData.images);

  const imgSrc = useMemo(() => images[imgIndex]!, [images, imgIndex]);

  return <ImageRenderView key={imgSrc} src={imgSrc} />;
};

export default ImageRenderer;
