import { useMemo } from "react";

import { usePluginAPI } from "../pluginApi";
import { useAutoplay } from "../utils/useAutoplay";
import ImageRenderView from "./ImageRenderView";

const ImageRenderer = () => {
  const pluginApi = usePluginAPI();
  const imgIndex = pluginApi.renderer.useData((x) => x.imgIndex);

  const images = pluginApi.scene.useData((x) => x.pluginData.images);

  // Get derivation offset for confidence monitor mode
  const derivationOffset = pluginApi.renderer.useDerivationOffset();

  const { shouldAutoPlay, calculatedAutoplaySlideIndex } = useAutoplay(
    imgIndex ?? 0,
  );

  const activeIndex = useMemo(() => {
    let index: number | undefined;
    if (
      shouldAutoPlay &&
      calculatedAutoplaySlideIndex !== null &&
      calculatedAutoplaySlideIndex !== undefined
    ) {
      index = calculatedAutoplaySlideIndex;
    } else {
      index = imgIndex;
    }

    // Apply derivation offset
    if (derivationOffset !== 0 && index !== undefined) {
      const derivedIndex = index + derivationOffset;
      // Return -1 if out of bounds (shows nothing)
      if (derivedIndex < 0 || derivedIndex >= images.length) {
        return -1;
      }
      return derivedIndex;
    }

    return index;
  }, [
    shouldAutoPlay,
    calculatedAutoplaySlideIndex,
    imgIndex,
    derivationOffset,
    images.length,
  ]);

  return images.map((imgSrc, i) => (
    <div
      key={`${i}-${pluginApi.media.resolveMediaUrl(imgSrc)}`}
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        opacity: activeIndex === i ? 1 : 0,
      }}
    >
      <ImageRenderView src={imgSrc} isActive={activeIndex === i} />
    </div>
  ));
};

export default ImageRenderer;
