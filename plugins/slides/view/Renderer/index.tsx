import { importWithRetry } from "@repo/ui";
import { Suspense, lazy, useEffect, useMemo } from "react";

import { getEffectiveDisplayMode, hasOfficeSlideshow } from "../../src/types";
import { InkLayer } from "../Ink/InkLayer";
import { usePluginAPI } from "../pluginApi";
import { GoogleSlideRenderer } from "./GoogleSlideRenderer";
import { ImageRenderer } from "./ImageRenderer";
import { LayoutSlideRenderer } from "./LayoutSlideRenderer";
import { PowerPointFallback } from "./PowerPointFallback";
import { HeldScene } from "./ReplaceHold/HeldScene";
import {
  type LoadingReporters,
  useReplaceHold,
} from "./ReplaceHold/useReplaceHold";
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

/** One copy of the slides, drawn from the scene its `HeldScene` gives */
const SlidesLayer = ({ onLoadingChange, onUnmount }: LoadingReporters) => {
  const pluginApi = usePluginAPI();
  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const rendererDisplayModes = pluginApi.renderer.useData(
    (x) => x.displayModes,
  );

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

  return (
    <>
      <ImageRenderer onLoadingChange={onLoadingChange} />

      <LayoutSlideRenderer />

      {hasPowerPointSlides && (
        <PowerPointFallback>
          <Suspense
            fallback={<ReportLoading onLoadingChange={onLoadingChange} />}
          >
            <PowerPointRenderer onLoadingChange={onLoadingChange} />
          </Suspense>
        </PowerPointFallback>
      )}

      {googleSlidesImports.map((imp) => (
        <GoogleSlideRenderer
          key={imp.fetchId}
          importId={imp.importId}
          onLoadingChange={onLoadingChange}
          onUnmount={onUnmount}
        />
      ))}
    </>
  );
};

const Renderer = () => {
  const pluginApi = usePluginAPI();
  const scene = pluginApi.scene.useData((x) => x);
  const setAwarenessStateData = pluginApi.awareness.setAwarenessStateData;

  const { layers, isLoading } = useReplaceHold(scene);

  useEffect(() => {
    setAwarenessStateData({ isLoading });
  }, [isLoading, setAwarenessStateData]);

  if ((scene.pluginData.slideOrder?.length ?? 0) === 0) {
    return null;
  }

  // Keyed by layer, so a held deck keeps its elements while the new one loads beside it, hidden
  return (
    <>
      {layers.map((layer) => (
        <div
          key={layer.key}
          style={layer.hidden ? hiddenLayerStyle : layerStyle}
        >
          <HeldScene scene={layer.scene}>
            <SlidesLayer {...layer.reporters} />
          </HeldScene>
        </div>
      ))}

      <SlideVideoOverlay />

      <InkLayer />
    </>
  );
};

const layerStyle = { position: "absolute", inset: 0 } as const;
const hiddenLayerStyle = { ...layerStyle, opacity: 0 } as const;

export default Renderer;
