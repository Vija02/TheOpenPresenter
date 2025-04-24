import { Box, Button, Stack } from "@chakra-ui/react";
import { constructMediaName } from "@repo/lib";
import { PluginScaffold, PopConfirm, Slide, SlideGrid } from "@repo/ui";
import { useCallback } from "react";
import { VscTrash } from "react-icons/vsc";

import ImageRenderView from "../ImageRenderer/ImageRenderView";
import { usePluginAPI } from "../pluginApi";
import { UploadModal } from "./UploadModal";

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
        <Box p={3} width="100%">
          <SlideGrid>
            {pluginData.images.map((x, i) => (
              <Stack
                key={pluginApi.media.resolveMediaUrl(x)}
                direction="column"
                justifyContent="center"
              >
                <Slide
                  isActive={i === imgIndex}
                  onClick={() => {
                    rendererData.imgIndex = i;
                    pluginApi.renderer.setRenderCurrentScene();
                  }}
                >
                  <ImageRenderView src={pluginApi.media.resolveMediaUrl(x)} />
                </Slide>
                <PopConfirm
                  title={`Are you sure you want to remove this image?`}
                  onConfirm={() => handleRemove(i)}
                  okText="Yes"
                  cancelText="No"
                  key="remove"
                >
                  <Button size="sm" variant="ghost" rounded="none">
                    <VscTrash />
                  </Button>
                </PopConfirm>
              </Stack>
            ))}
          </SlideGrid>
        </Box>
      }
    />
  );
};

export default ImageRemote;
