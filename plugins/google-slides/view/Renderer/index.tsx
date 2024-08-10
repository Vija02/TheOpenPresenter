import { Box } from "@chakra-ui/react";
import { useMemo } from "react";

import { pluginApi } from "../util";
import RenderView from "./RenderView";

const Renderer = () => {
  const data = pluginApi.renderer.useData((x) => x);
  const slideIndex = data.slideIndex!;

  const slideIds = pluginApi.scene.useData((x) => x.pluginData.slideIds);
  const slideLink = pluginApi.scene.useData((x) => x.pluginData.slideLink);

  const slideId = useMemo(() => slideIds[slideIndex]!, [slideIds, slideIndex]);

  return (
    <Box w="100vw" h="100vh">
      <RenderView key={slideLink} src={slideLink} slideId={slideId} />
    </Box>
  );
};

export default Renderer;
