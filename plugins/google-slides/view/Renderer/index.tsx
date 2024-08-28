import { Box } from "@chakra-ui/react";
import { useMemo } from "react";

import { pluginApi } from "../pluginApi";
import RenderView from "./RenderView";

const Renderer = () => {
  const data = pluginApi.renderer.useData((x) => x);
  const slideIndex = useMemo(() => data.slideIndex!, [data.slideIndex]);

  const pageIds = pluginApi.scene.useData((x) => x.pluginData.pageIds);
  const presentationId = pluginApi.scene.useData(
    (x) => x.pluginData.presentationId,
  );

  const selectedPageId = useMemo(
    () => pageIds[slideIndex]!,
    [pageIds, slideIndex],
  );

  const slideSrc = useMemo(
    () =>
      `https://docs.google.com/presentation/d/${presentationId}/embed?rm=minimal`,
    [presentationId],
  );

  return (
    <Box w="100vw" h="100vh">
      <RenderView key={slideSrc} src={slideSrc} slideId={selectedPageId} />
    </Box>
  );
};

export default Renderer;
