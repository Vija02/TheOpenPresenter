import { usePluginAPI } from "../pluginApi";
import ImageRenderView from "./ImageRenderView";

const ImageRenderer = () => {
  const pluginApi = usePluginAPI();
  const data = pluginApi.renderer.useData((x) => x);
  const imgIndex = data.imgIndex;

  const images = pluginApi.scene.useData((x) => x.pluginData.images);

  return images.map((imgSrc, i) => (
    <div
      key={pluginApi.media.resolveMediaUrl(imgSrc)}
      style={{
        position: "absolute",
        width: "100vw",
        height: "100vh",
        opacity: imgIndex === i ? 1 : 0,
      }}
    >
      <ImageRenderView src={pluginApi.media.resolveMediaUrl(imgSrc)} />
    </div>
  ));
};

export default ImageRenderer;
