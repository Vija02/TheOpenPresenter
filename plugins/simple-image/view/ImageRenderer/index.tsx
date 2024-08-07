import { Box } from "@chakra-ui/react";
import { useMemo } from "react";

import { pluginApi } from "../util";
import ImageRenderView from "./ImageRenderView";

const ImageRenderer = () => {
  const data = pluginApi.renderer.useData((x) => x);
  const imgIndex = data.imgIndex;

  const images = pluginApi.scene.useData((x) => x.pluginData.images);

  const imgSrc = useMemo(() => images[imgIndex]!, [images, imgIndex]);

  return (
    <Box w="100vw" h="100vh">
      <ImageRenderView key={imgSrc} src={imgSrc} />
    </Box>
  );
};

export default ImageRenderer;
