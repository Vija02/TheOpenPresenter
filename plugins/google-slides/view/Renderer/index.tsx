import { Box } from "@chakra-ui/react";
import { useMemo } from "react";

import { usePluginAPI } from "../pluginApi";
import RenderView from "./RenderView";

const Renderer = () => {
  const pluginApi = usePluginAPI();
  const data = pluginApi.renderer.useData((x) => x);
  const slideIndex = useMemo(() => data.slideIndex!, [data.slideIndex]);

  const pageIds = pluginApi.scene.useData((x) => x.pluginData.pageIds);

  const selectedPageId = useMemo(
    () => pageIds[slideIndex]!,
    [pageIds, slideIndex],
  );

  const slideSrc = useMemo(() => {
    return (
      pluginApi.env.getRootURL() +
      `/plugin/google-slides/proxy?sceneId=${pluginApi.pluginContext.sceneId}&pluginId=${pluginApi.pluginContext.pluginId}`
    );
  }, [
    pluginApi.env,
    pluginApi.pluginContext.pluginId,
    pluginApi.pluginContext.sceneId,
  ]);

  return (
    <Box w="100vw" h="100vh">
      <RenderView key={slideSrc} src={slideSrc} slideId={selectedPageId} />
    </Box>
  );
};

export default Renderer;
