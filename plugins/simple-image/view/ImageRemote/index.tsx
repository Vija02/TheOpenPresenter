import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { Slide } from "@repo/ui";

import ImageRenderView from "../ImageRenderer/ImageRenderView";
import { usePluginAPI } from "../pluginApi";
import { UploadModal } from "./UploadModal";

const ImageRemote = () => {
  const pluginApi = usePluginAPI();

  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const imgIndex = pluginApi.renderer.useData((x) => x.imgIndex);

  const rendererData = pluginApi.renderer.useValtioData();

  return (
    <Box>
      <Box p={3} bg="gray.900">
        <Stack direction="row" alignItems="center" gap={5}>
          <Stack direction="row" alignItems="center">
            <Text fontWeight="bold" color="white">
              <Text>Simple Image</Text>
            </Text>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={2}>
            <UploadModal />
          </Stack>
        </Stack>
      </Box>

      <Box p={3}>
        <Flex gap={3} flexWrap="wrap">
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
        </Flex>
      </Box>
    </Box>
  );
};

export default ImageRemote;
