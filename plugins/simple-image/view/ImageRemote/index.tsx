import { Box, Flex } from "@chakra-ui/react";
import Uppy from "@uppy/core";
import { FileInput, StatusBar, useUppyEvent } from "@uppy/react";
import XHR from "@uppy/xhr-upload";
import { useState } from "react";

import { PluginBaseData } from "../../src/types";
import ImageRenderView from "../ImageRenderer/ImageRenderView";
import { pluginApi } from "../util";

const ImageRemote = () => {
  const [uppy] = useState(() =>
    new Uppy().use(XHR, {
      endpoint: "/media/upload/formData",
    }),
  );
  const sceneData = pluginApi.scene.useValtioData();

  useUppyEvent(uppy, "upload-success", (_file, response) => {
    const url = (response.body as any)?.url as string;

    sceneData.pluginData.images.push(url);
  });

  const pluginData = pluginApi.scene.useData<PluginBaseData>(
    (x) => x.pluginData,
  );

  const rendererData = pluginApi.renderer.useValtioData();
  const setRenderCurrentScene = pluginApi.useSetRenderCurrentScene();

  return (
    <Box p={3}>
      <FileInput uppy={uppy} pretty />
      <StatusBar uppy={uppy} />
      <Flex gap={3} flexWrap="wrap">
        {pluginData.images.map((x, i) => (
          <Box
            key={i}
            cursor="pointer"
            onClick={() => {
              rendererData.imgIndex = i;
              setRenderCurrentScene();
            }}
          >
            <Box
              aspectRatio={4 / 3}
              w="200px"
              border="1px"
              borderColor={
                i === rendererData.imgIndex ? "blue.600" : "gray.200"
              }
            >
              <ImageRenderView src={x} />
            </Box>
          </Box>
        ))}
      </Flex>
    </Box>
  );
};

export default ImageRemote;
