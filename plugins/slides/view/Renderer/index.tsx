import { useCallback, useEffect, useMemo, useState } from "react";

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
  const setAwarenessStateData = pluginApi.awareness.setAwarenessStateData;

  const hasSlides = (pluginData.slideOrder?.length ?? 0) > 0;

  const googleSlidesImports = useMemo(() => {
    return Object.values(pluginData.imports).filter(
      (imp) =>
        !imp._isFetching &&
        imp.type === "googleslides" &&
        getEffectiveDisplayMode(imp, rendererDisplayModes) === "googleslides",
    );
  }, [pluginData.imports, rendererDisplayModes]);

  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  const reportLoading = useCallback((id: string, isLoading: boolean) => {
    setLoadingMap((prev) => {
      if (prev[id] === isLoading) return prev;
      return { ...prev, [id]: isLoading };
    });
  }, []);

  const unregisterLoading = useCallback((id: string) => {
    setLoadingMap((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const isLoading = Object.values(loadingMap).some(Boolean);

  useEffect(() => {
    setAwarenessStateData({ isLoading });
  }, [isLoading, setAwarenessStateData]);

  if (!hasSlides) {
    return null;
  }

  return (
    <>
      <ImageRenderer onLoadingChange={reportLoading} />

      {googleSlidesImports.map((imp) => (
        <GoogleSlideRenderer
          key={imp.fetchId}
          importId={imp.importId}
          onLoadingChange={reportLoading}
          onUnmount={unregisterLoading}
        />
      ))}
    </>
  );
};

export default Renderer;
