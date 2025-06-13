import { constructMediaName } from "@repo/lib";
import { Button, PluginScaffold, PopConfirm, Slide, SlideGrid } from "@repo/ui";
import { useCallback } from "react";
import { VscTrash } from "react-icons/vsc";

import ImageRenderView from "../Renderer/ImageRenderView";
import { usePluginAPI } from "../pluginApi";
import { UploadModal } from "./UploadModal";
import "./index.css";

const ImageRemote = () => {
  const pluginApi = usePluginAPI();

  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const imgIndex = pluginApi.renderer.useData((x) => x.imgIndex);

  const mutableSceneData = pluginApi.scene.useValtioData();
  const rendererData = pluginApi.renderer.useValtioData();

  const handleRemove = useCallback(
    async (index: number) => {
      if (pluginData.images[index]) {
        // If internal, delete that media
        if (pluginApi.media.isInternalMedia(pluginData.images[index])) {
          const mediaName = constructMediaName(
            pluginData.images[index].mediaId,
            pluginData.images[index].extension,
          );
          await pluginApi.media.deleteMedia(mediaName);
        }

        mutableSceneData.pluginData.images.splice(index, 1);
      }
    },
    [mutableSceneData.pluginData.images, pluginApi.media, pluginData.images],
  );

  return (
    <PluginScaffold
      title="Simple Image"
      toolbar={<UploadModal />}
      body={
        <div className="p-3 w-full">
          <SlideGrid>
            {pluginData.images.map((imgSrc, i) => (
              <div
                key={pluginApi.media.resolveMediaUrl(imgSrc)}
                className="stack-col items-stretch justify-center"
              >
                <Slide
                  isActive={i === imgIndex}
                  onClick={() => {
                    rendererData.imgIndex = i;
                    pluginApi.renderer.setRenderCurrentScene();
                  }}
                >
                  {({ width }) => (
                    <ImageRenderView
                      src={imgSrc}
                      isActive={i === imgIndex}
                      width={width}
                    />
                  )}
                </Slide>
                <PopConfirm
                  title={`Are you sure you want to remove this image?`}
                  onConfirm={() => handleRemove(i)}
                  okText="Yes"
                  cancelText="No"
                  key="remove"
                >
                  <Button size="sm" variant="ghost">
                    <VscTrash />
                  </Button>
                </PopConfirm>
              </div>
            ))}
          </SlideGrid>
        </div>
      }
    />
  );
};

export default ImageRemote;
