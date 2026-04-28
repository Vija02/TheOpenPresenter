import { useMemo } from "react";

import { getEffectiveDisplayMode } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import { GoogleSlideRenderer } from "./GoogleSlideRenderer";
import { ImageRenderer } from "./ImageRenderer";

const Renderer = () => {
  const pluginApi = usePluginAPI();
  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const rendererDisplayModes = pluginApi.renderer.useData(
    (x) => x.displayModes,
  );

  const hasSlides = (pluginData.slideOrder?.length ?? 0) > 0;

  const googleSlidesImports = useMemo(() => {
    return Object.values(pluginData.imports).filter(
      (imp) =>
        !imp._isFetching &&
        imp.type === "googleslides" &&
        getEffectiveDisplayMode(imp, rendererDisplayModes) === "googleslides",
    );
  }, [pluginData.imports, rendererDisplayModes]);

  if (!hasSlides) {
    return null;
  }

  return (
    <>
      <ImageRenderer />

      {googleSlidesImports.map((imp) => (
        <GoogleSlideRenderer key={imp.fetchId} importId={imp.importId} />
      ))}
    </>
  );
};

export default Renderer;
