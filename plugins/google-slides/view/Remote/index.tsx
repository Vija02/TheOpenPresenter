import { Box, Button, Flex, Input, Text } from "@chakra-ui/react";
import { useState } from "react";

import { PluginBaseData, RendererBaseData } from "../../src/types";
import RenderView from "../Renderer/RenderView";
import { trpc } from "../trpc";
import { pluginApi } from "../util";

const Remote = () => {
  const [linkValue, setLinkValue] = useState("");
  const sceneData = pluginApi.scene.useValtioData();
  const pluginContext = pluginApi.usePluginDataContext().pluginContext;

  const setLinkMutation = trpc.googleslides.setLink.useMutation();

  return (
    <Box p={3}>
      <Input value={linkValue} onChange={(e) => setLinkValue(e.target.value)} />
      <Button
        onClick={() => {
          setLinkMutation.mutate({
            pluginId: pluginContext.pluginId,
            sceneId: pluginContext.sceneId,
            slideLink: linkValue,
          });
        }}
      >
        Link
      </Button>

      <Flex gap={3} flexWrap="wrap">
        <RemoteHandler />
      </Flex>
    </Box>
  );
};

const RemoteHandler = () => {
  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const rendererData = pluginApi.renderer.useData((x) => x);

  const mutableRendererData = pluginApi.renderer.useValtioData();
  const setRenderCurrentScene = pluginApi.useSetRenderCurrentScene();

  // const { data } = trpc.googleslides.proxy.useQuery({
  //   slideLink: pluginData.slideLink,
  // });

  // <iframe srcDoc={data} />;

  return (
    <>
      {pluginData.slideIds.map((x, i) => (
        <Box key={i} cursor="pointer" position="relative">
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            onClick={() => {
              mutableRendererData.slideIndex = i;
              setRenderCurrentScene();
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
            border="1px"
            borderColor={i === rendererData.slideIndex ? "red.600" : "gray.200"}
          >
            {/* <RenderView
              key={pluginData.slideLink}
              src={pluginData.slideLink}
              slideId={x}
            /> */}
            <Text>{x}</Text>
          </Box>
        </Box>
      ))}
    </>
  );
};

export default Remote;
