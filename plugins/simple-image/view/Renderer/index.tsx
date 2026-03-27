import { useMemo } from "react";

import { usePluginAPI } from "../pluginApi";
import { useAutoplay } from "../utils/useAutoplay";
import ImageRenderView from "./ImageRenderView";

const ImageRenderer = () => {
  const pluginApi = usePluginAPI();
  const imgIndex = pluginApi.renderer.useData((x) => x.imgIndex);

  const images = pluginApi.scene.useData((x) => x.pluginData.images);

  const { shouldAutoPlay, calculatedAutoplaySlideIndex } = useAutoplay(
    imgIndex ?? 0,
  );

  const activeIndex = useMemo(() => {
    if (
      shouldAutoPlay &&
      calculatedAutoplaySlideIndex !== null &&
      calculatedAutoplaySlideIndex !== undefined
    ) {
      return calculatedAutoplaySlideIndex;
    }
    return imgIndex;
  }, [shouldAutoPlay, calculatedAutoplaySlideIndex, imgIndex]);

  return images.map((imgSrc, i) => (
    <div
      key={pluginApi.media.resolveMediaUrl(imgSrc)}
      style={{
        position: "absolute",
        width: "100vw",
        height: "100dvh",
        opacity: activeIndex === i ? 1 : 0,
      }}
    >
      <ImageRenderView src={imgSrc} isActive={activeIndex === i} />
    </div>
  ));
};

export default ImageRenderer;
