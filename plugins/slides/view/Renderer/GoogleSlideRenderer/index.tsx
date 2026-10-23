import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { toFlatPosition } from "../../../src/slides/autoplay";
import {
  embedVideoFinish,
  getEmbedClickCounts,
  toEmbedClickCount,
} from "../../../src/slides/order";
import { usePluginAPI } from "../../pluginApi";
import { useDisplayedSlide } from "../../utils/useDisplayedSlide";
import RenderView, { RenderViewHandle } from "./RenderView";
import { googleSlideSrc } from "./slideSrc";
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

  const slideSrc = useMemo(
    () => googleSlideSrc(pluginApi.pluginContext.pluginId, importId),
    [pluginApi.pluginContext.pluginId, importId],
  );

  const { resolvedSlide, clickCount: effectiveClickCount } =
    useDisplayedSlide();

  const effectiveLocalIndex = useMemo(() => {
    if (!resolvedSlide) return -1;
    if (resolvedSlide.importData.importId !== importId) return -1;
    return resolvedSlide.localSlideIndex;
  }, [resolvedSlide, importId]);

  const isActive = effectiveLocalIndex !== -1;

  const importData = pluginApi.scene.useData(
    (x) => x.pluginData.imports[importId],
  );
  // The embed's own steps. Ours add some for manual videos, after these,
  // which must never reach it as key presses
  const embedClickCounts = useMemo(
    () => (importData ? getEmbedClickCounts(importData) : []),
    [importData],
  );
  const embedClickCount =
    effectiveLocalIndex < 0
      ? effectiveClickCount
      : toEmbedClickCount(
          effectiveClickCount,
          embedClickCounts[effectiveLocalIndex] ?? 0,
        );
  const transitionEndsAt = pluginApi.renderer.useData(
    (x) => x.transitionEndsAt,
  );
  const lastClickTimestamp = pluginApi.renderer.useData(
    (x) => x.lastClickTimestamp,
  );

  const videoFinishAt = useCallback(
    (slideIndex: number, clickCount: number) =>
      importData ? embedVideoFinish(importData, slideIndex, clickCount) : null,
    [importData],
  );

  const targetFlatPosition = useMemo(() => {
    if (effectiveLocalIndex < 0) return -1;
    return toFlatPosition(
      effectiveLocalIndex,
      embedClickCount,
      embedClickCounts,
    );
  }, [effectiveLocalIndex, embedClickCount, embedClickCounts]);

  useIframeSync({
    ref,
    loaded,
    targetSlideIndex: effectiveLocalIndex,
    targetClickCount: embedClickCount,
    targetFlatPosition,
    transitionEndsAt: transitionEndsAt ?? 0,
    lastClickTimestamp: lastClickTimestamp ?? 0,
    videoFinishAt,
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
