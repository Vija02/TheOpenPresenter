import { extractMediaName } from "@repo/lib";
import {
  Button,
  OverlayToggle,
  PluginScaffold,
  PopConfirm,
  Slide,
  SlideGrid,
} from "@repo/ui";
import { useCallback, useMemo } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa6";
import { MdPhotoLibrary } from "react-icons/md";
import { VscSettingsGear, VscTrash } from "react-icons/vsc";

import ImageRenderView from "../Renderer/ImageRenderView";
import { usePluginAPI } from "../pluginApi";
import { useAutoplay } from "../utils/useAutoplay";
import { SettingsModal } from "./SettingsModal";
import "./index.css";

const ImageRemote = () => {
  const pluginApi = usePluginAPI();

  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const imgIndex = pluginApi.renderer.useData((x) => x.imgIndex);

  const mutableSceneData = pluginApi.scene.useValtioData();
  const rendererData = pluginApi.renderer.useValtioData();

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

  const handleRemove = useCallback(
    async (index: number) => {
      if (pluginData.images[index]) {
        // If internal, delete that media
        if (pluginApi.media.isInternalMedia(pluginData.images[index])) {
          await pluginApi.media.unlinkMediaFromPlugin(
            pluginData.images[index].mediaId,
          );
        }

        mutableSceneData.pluginData.images.splice(index, 1);
      }
    },
    [mutableSceneData.pluginData.images, pluginApi.media, pluginData.images],
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index > 0) {
        const images = mutableSceneData.pluginData.images;
        const temp = images[index];
        images[index] = images[index - 1]!;
        images[index - 1] = temp!;

        // Update imgIndex if needed
        if (rendererData.imgIndex === index) {
          rendererData.imgIndex = index - 1;
        } else if (rendererData.imgIndex === index - 1) {
          rendererData.imgIndex = index;
        }
      }
    },
    [mutableSceneData.pluginData.images, rendererData],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      const images = mutableSceneData.pluginData.images;
      if (index < images.length - 1) {
        const temp = images[index];
        images[index] = images[index + 1]!;
        images[index + 1] = temp!;

        // Update imgIndex if needed
        if (rendererData.imgIndex === index) {
          rendererData.imgIndex = index + 1;
        } else if (rendererData.imgIndex === index + 1) {
          rendererData.imgIndex = index;
        }
      }
    },
    [mutableSceneData.pluginData.images, rendererData],
  );

  const handleMediaPicker = useCallback(async () => {
    const result = await pluginApi.mediaPicker.show({
      type: "image",
      title: "Select Image",
    });

    if (result) {
      const { mediaId, extension } = extractMediaName(result.mediaName);
      mutableSceneData.pluginData.images.push({ mediaId, extension });
    }
  }, [pluginApi.mediaPicker, mutableSceneData.pluginData.images]);

  return (
    <PluginScaffold
      title="Simple Image"
      postToolbar={
        <OverlayToggle
          toggler={({ onToggle }) => (
            <Button size="xs" variant="pill" onClick={onToggle}>
              <VscSettingsGear />
              Settings
            </Button>
          )}
        >
          <SettingsModal />
        </OverlayToggle>
      }
      toolbar={
        <Button size="xs" variant="pill" onClick={handleMediaPicker}>
          <MdPhotoLibrary /> Add Image
        </Button>
      }
      body={
        <div className="p-3 w-full">
          <SlideGrid pluginAPI={pluginApi}>
            {pluginData.images.map((imgSrc, i) => (
              <Slide
                key={`${i}-${pluginApi.media.resolveMediaUrl(imgSrc)}`}
                pluginAPI={pluginApi}
                heading={`Image ${i + 1}`}
                headingRight={
                  <div className="flex items-center gap-1">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveUp(i);
                      }}
                      disabled={i === 0}
                    >
                      <FaChevronUp />
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveDown(i);
                      }}
                      disabled={i === pluginData.images.length - 1}
                    >
                      <FaChevronDown />
                    </Button>
                    <PopConfirm
                      title={`Are you sure you want to remove this image?`}
                      onConfirm={() => handleRemove(i)}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <VscTrash />
                      </Button>
                    </PopConfirm>
                  </div>
                }
                isActive={i === activeIndex}
                onClick={() => {
                  rendererData.imgIndex = i;
                  rendererData.lastClickTimestamp = Date.now();
                  pluginApi.renderer.setRenderCurrentScene();
                }}
              >
                {({ width }) => (
                  <ImageRenderView
                    src={imgSrc}
                    isActive={i === activeIndex}
                    width={width}
                  />
                )}
              </Slide>
            ))}
          </SlideGrid>
        </div>
      }
    />
  );
};

export default ImageRemote;
