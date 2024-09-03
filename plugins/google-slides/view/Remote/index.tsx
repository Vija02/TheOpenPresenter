import { Box, Center, Flex, Image, Text } from "@chakra-ui/react";

import { usePluginAPI } from "../pluginApi";
import { trpc } from "../trpc";
import { SlidePicker } from "./SlidePicker";

const Remote = () => {
  const pluginApi = usePluginAPI();
  const pluginContext = pluginApi.pluginContext;

  const selectSlideMutation = trpc.googleslides.selectSlide.useMutation();

  return (
    <Box p={3}>
      <SlidePicker
        onFileSelected={(data, token) => {
          const picker = google.picker;
          if (data[picker.Response.ACTION] === "picked") {
            if (data[picker.Response.DOCUMENTS].length > 0) {
              const docs = data[picker.Response.DOCUMENTS][0]!;

              const id = docs[picker.Document.ID];

              selectSlideMutation.mutate({
                pluginId: pluginContext.pluginId,
                sceneId: pluginContext.sceneId,
                presentationId: id,
                token: token,
              });
            }
          }
        }}
      />

      <Flex gap={3} flexWrap="wrap">
        <RemoteHandler />
      </Flex>
    </Box>
  );
};

const RemoteHandler = () => {
  const pluginApi = usePluginAPI();
  const pageIds = pluginApi.scene.useData((x) => x.pluginData.pageIds);
  const thumbnailLinks = pluginApi.scene.useData(
    (x) => x.pluginData.thumbnailLinks,
  );
  const rendererData = pluginApi.renderer.useData((x) => x);

  const mutableRendererData = pluginApi.renderer.useValtioData();

  return (
    <>
      {pageIds.map((x, i) => (
        <Box key={i} cursor="pointer" position="relative">
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            onClick={() => {
              mutableRendererData.slideIndex = i;
              pluginApi.renderer.setRenderCurrentScene();
            }}
          />
          <Text
            fontWeight="bold"
            textTransform="uppercase"
            fontSize="xs"
            mb={1}
          >
            Slide {i + 1}
          </Text>
          <Box
            aspectRatio={4 / 3}
            w="200px"
            border="4px"
            borderColor={
              i === rendererData.slideIndex ? "red.600" : "transparent"
            }
          >
            {thumbnailLinks?.[i] ? (
              <Center>
                <Image src={pluginApi.media.getUrl(thumbnailLinks[i]!)} />
              </Center>
            ) : (
              <Text
                height="100%"
                border="1px solid"
                borderColor="gray.200"
                p={2}
              >
                Loading...
              </Text>
            )}
          </Box>
        </Box>
      ))}
    </>
  );
};

export default Remote;
