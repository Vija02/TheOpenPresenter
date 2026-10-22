import { importWithRetry } from "@repo/ui";
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getEffectiveDisplayMode, hasOfficeSlideshow } from "../../src/types";
import { InkLayer } from "../Ink/InkLayer";
import { usePluginAPI } from "../pluginApi";
import { GoogleSlideRenderer } from "./GoogleSlideRenderer";
import { ImageRenderer } from "./ImageRenderer";
import { LayoutSlideRenderer } from "./LayoutSlideRenderer";
import { PowerPointFallback } from "./PowerPointFallback";
import { SlideVideoOverlay } from "./SlideVideoOverlay";

// Only fetched by shows that play a PowerPoint deck
const PowerPointRenderer = lazy(() =>
  importWithRetry(() => import("./PowerPointRenderer")).then((module) => ({
    default: module.PowerPointRenderer,
  })),
);
const POWERPOINT_LOADING_ID = "__powerpoint_renderer_code__";

/** Shows the screen as loading while the PowerPoint renderer's code arrives */
const ReportLoading = ({
  onLoadingChange,
}: {
  onLoadingChange: (id: string, isLoading: boolean) => void;
}) => {
  useEffect(() => {
    onLoadingChange(POWERPOINT_LOADING_ID, true);
    return () => onLoadingChange(POWERPOINT_LOADING_ID, false);
  }, [onLoadingChange]);
  return null;
};

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

  const hasPowerPointSlides = useMemo(
    () =>
      Object.values(pluginData.imports).some(
        (imp) =>
          !imp._isFetching &&
          hasOfficeSlideshow(imp) &&
          getEffectiveDisplayMode(imp, rendererDisplayModes) === "powerpoint",
      ),
    [pluginData.imports, rendererDisplayModes],
  );

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

      <LayoutSlideRenderer />

      {hasPowerPointSlides && (
        <PowerPointFallback>
          <Suspense
            fallback={<ReportLoading onLoadingChange={reportLoading} />}
          >
            <PowerPointRenderer onLoadingChange={reportLoading} />
          </Suspense>
        </PowerPointFallback>
      )}

      {googleSlidesImports.map((imp) => (
        <GoogleSlideRenderer
          key={imp.fetchId}
          importId={imp.importId}
          onLoadingChange={reportLoading}
          onUnmount={unregisterLoading}
        />
      ))}

      <SlideVideoOverlay />

      <InkLayer />
    </>
  );
};

export default Renderer;
