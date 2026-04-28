import { useEffect, useMemo, useRef, useState } from "react";

import { usePluginAPI } from "../../pluginApi";
import { useDisplayedSlide } from "../../utils/useDisplayedSlide";
import RenderView, { RenderViewHandle } from "./RenderView";
import { useIframeSync } from "./useIframeSync";

interface GoogleSlideRendererProps {
  importId: string;
}

export const GoogleSlideRenderer = ({ importId }: GoogleSlideRendererProps) => {
  const ref = useRef<RenderViewHandle>(null);
  const [loaded, setLoaded] = useState(false);

  const pluginApi = usePluginAPI();
  const setAwarenessStateData = pluginApi.awareness.setAwarenessStateData;

  const slideSrc = useMemo(() => {
    return (
      window.location.origin +
      `/plugin/google-slides/proxy?pluginId=${pluginApi.pluginContext.pluginId}&importId=${importId}`
    );
  }, [pluginApi.pluginContext.pluginId, importId]);

  const { resolvedSlide, clickCount: effectiveClickCount } =
    useDisplayedSlide();

  const effectiveLocalIndex = useMemo(() => {
    if (!resolvedSlide) return -1;
    if (resolvedSlide.importData.importId !== importId) return -1;
    return resolvedSlide.localSlideIndex;
  }, [resolvedSlide, importId]);

  const isActive = effectiveLocalIndex !== -1;

  useIframeSync({
    ref,
    loaded,
    targetSlideIndex: effectiveLocalIndex,
    targetClickCount: effectiveClickCount,
  });

  // TODO: This needs to account for the other ones too
  useEffect(() => {
    setAwarenessStateData({ isLoading: !loaded });
  }, [loaded, setAwarenessStateData]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: isActive ? 1 : 0,
      }}
    >
      <RenderView
        ref={ref}
        key={slideSrc}
        src={slideSrc}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
};
