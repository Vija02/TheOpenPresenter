import { Box, Stack, Text } from "@chakra-ui/react";
import { PluginScaffold, Slide, SlideGrid } from "@repo/ui";

import ImageRenderView from "../ImageRenderer/ImageRenderView";
import { usePluginAPI } from "../pluginApi";
import { UploadModal } from "./UploadModal";

const ImageRemote = () => {
  const pluginApi = usePluginAPI();

  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const imgIndex = pluginApi.renderer.useData((x) => x.imgIndex);

  const rendererData = pluginApi.renderer.useValtioData();

  return (
    <PluginScaffold
      title="Simple Image"
      toolbar={<UploadModal />}
      body={
        <Box p={3} width="100%">
          <SlideGrid>
            {pluginData.images.map((x, i) => (
              <Slide
                key={i}
                isActive={i === imgIndex}
                onClick={() => {
                  rendererData.imgIndex = i;
                  pluginApi.renderer.setRenderCurrentScene();
                }}
              >
                <ImageRenderView src={x} />
              </Slide>
            ))}
          </SlideGrid>
        </Box>
      }
    />
  );
};

export default ImageRemote;
