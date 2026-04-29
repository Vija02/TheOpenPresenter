import { useEffect, useMemo, useRef, useState } from "react";

import { usePluginAPI } from "../../pluginApi";
import { useDisplayedSlide } from "../../utils/useDisplayedSlide";
import RenderView, { RenderViewHandle } from "./RenderView";
import { useIframeSync } from "./useIframeSync";

interface GoogleSlideRendererProps {
  importId: string;
  onLoadingChange: (id: string, isLoading: boolean) => void;
  onUnmount: (id: string) => void;
}

export const GoogleSlideRenderer = ({
  importId,
  onLoadingChange,
  onUnmount,
}: GoogleSlideRendererProps) => {
  const ref = useRef<RenderViewHandle>(null);
  const [loaded, setLoaded] = useState(false);

  const pluginApi = usePluginAPI();

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

  useEffect(() => {
    onLoadingChange(importId, !loaded);
  }, [loaded, importId, onLoadingChange]);

  useEffect(() => {
    return () => onUnmount(importId);
  }, [importId, onUnmount]);

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
