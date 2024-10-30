import { Box, Flex } from "@chakra-ui/react";
import { appData } from "@repo/lib";
import Uppy from "@uppy/core";
import { FileInput, StatusBar, useUppyEvent } from "@uppy/react";
import XHR from "@uppy/xhr-upload";
import { useState } from "react";

import { PluginBaseData } from "../../src/types";
import ImageRenderView from "../ImageRenderer/ImageRenderView";
import { usePluginAPI } from "../pluginApi";

const ImageRemote = () => {
  const pluginApi = usePluginAPI();
  const [uppy] = useState(() =>
    new Uppy({
      meta: { organizationId: pluginApi.pluginContext.organizationId },
    }).use(XHR, {
      endpoint: pluginApi.media.formDataUploadUrl,
      headers: {
        "csrf-token": appData.getCSRFToken(),
      },
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
  const setRenderCurrentScene = pluginApi.renderer.setRenderCurrentScene;

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
