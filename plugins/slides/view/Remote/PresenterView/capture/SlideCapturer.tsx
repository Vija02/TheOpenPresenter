import { useEffect, useMemo, useRef, useState } from "react";

import type { GoogleSlidesImportData } from "../../../../src/types";
import { getEffectiveDisplayMode } from "../../../../src/types";
import RenderView, {
  RenderViewHandle,
} from "../../../Renderer/GoogleSlideRenderer/RenderView";
import { googleSlideSrc } from "../../../Renderer/GoogleSlideRenderer/slideSrc";
import { usePluginAPI } from "../../../pluginApi";
import { slideCapturePlan } from "./capturePlan";
import { captureKey, captureStore } from "./captureStore";
import { CaptureCancelled, runCapturePlan } from "./runCapturePlan";

/**
 * Captures every position of the Google Slides imports shown in this scene,
 * one hidden embed per import, so the speaker view's previews can show a
 * finished picture of any step. Slides nearest the current one go first.
 */
export const SlideCapturer = ({ currentSlide }: { currentSlide: number }) => {
  const pluginApi = usePluginAPI();
  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const displayModes = pluginApi.renderer.useData((x) => x.displayModes);

  const googleImports = useMemo(
    () =>
      Object.values(pluginData.imports).filter(
        (imp): imp is GoogleSlidesImportData =>
          imp.type === "googleslides" &&
          !imp._isFetching &&
          getEffectiveDisplayMode(imp, displayModes) === "googleslides",
      ),
    [pluginData.imports, displayModes],
  );

  return (
    <>
      {googleImports.map((imp) => (
        <ImportCapturer
          key={imp.fetchId}
          importData={imp}
          currentSlide={currentSlide}
        />
      ))}
    </>
  );
};

const ImportCapturer = ({
  importData,
  currentSlide,
}: {
  importData: GoogleSlidesImportData;
  currentSlide: number;
}) => {
  const pluginApi = usePluginAPI();
  const pluginData = pluginApi.scene.useData((x) => x.pluginData);
  const viewRef = useRef<RenderViewHandle>(null);
  const { importId, fetchId } = importData;
  const src = useMemo(
    () => googleSlideSrc(pluginApi.pluginContext.pluginId, importId),
    [pluginApi.pluginContext.pluginId, importId],
  );

  // This import's slides in presentation order: [globalIndex, localIndex]
  const slides = useMemo(() => {
    const result: { globalIndex: number; localIndex: number }[] = [];
    (pluginData.slideOrder ?? []).forEach((ref, globalIndex) => {
      const [refImport, localIndex] = ref.split(":");
      if (refImport === importId) {
        result.push({ globalIndex, localIndex: Number(localIndex) });
      }
    });
    return result;
  }, [pluginData.slideOrder, importId]);

  const [loaded, setLoaded] = useState(false);
  // Captures outlive the speaker view: on reopen, skip loading the embed
  const [done, setDone] = useState(() =>
    slides.every(({ localIndex }) =>
      captureStore.has(
        captureKey(
          fetchId,
          localIndex,
          importData.slideClickCounts[localIndex] ?? 0,
        ),
      ),
    ),
  );

  // Read through refs so edits elsewhere in the import (speaker notes) don't
  // restart a run halfway through a slide: jumping to the slide already
  // showing does nothing, so the restart wouldn't be back at build 0.
  const currentRef = useRef(currentSlide);
  currentRef.current = currentSlide;
  const importRef = useRef(importData);
  importRef.current = importData;
  const slidesRef = useRef(slides);
  slidesRef.current = slides;

  useEffect(() => {
    if (!loaded || done) return;
    let cancelled = false;
    const isCancelled = () => cancelled;

    const isCaptured = (localIndex: number) => {
      const importData = importRef.current;
      const lastClick = importData.slideClickCounts[localIndex] ?? 0;
      return captureStore.has(captureKey(fetchId, localIndex, lastClick));
    };

    (async () => {
      // The embed draws its first slide a moment after load
      await new Promise((r) => setTimeout(r, 300));
      // Slides the embed wouldn't show; their previews keep the thumbnail
      const failed = new Set<number>();
      for (;;) {
        const importData = importRef.current;
        const remaining = slidesRef.current.filter(
          (s) => !isCaptured(s.localIndex) && !failed.has(s.localIndex),
        );
        if (remaining.length === 0) break;
        // Nearest the slide being shown, ahead before behind
        remaining.sort(
          (a, b) =>
            Math.abs(a.globalIndex - currentRef.current - 0.5) -
            Math.abs(b.globalIndex - currentRef.current - 0.5),
        );
        const { localIndex } = remaining[0]!;
        const view = viewRef.current;
        if (!view || cancelled) return;

        const slideId = importData.slideIds[localIndex];
        if (slideId !== undefined) {
          await runCapturePlan({
            view,
            localSlideIndex: localIndex,
            slideId,
            steps: slideCapturePlan({
              maxClicks: importData.slideClickCounts[localIndex] ?? 0,
              autoplayMs: importData.slideAutoplayDurations?.[localIndex] ?? 0,
              clickDurationsMs:
                importData.slideClickDurations?.[localIndex] ?? [],
            }),
            isCancelled,
            onCapture: (clickCount, svg) =>
              captureStore.set(
                captureKey(fetchId, localIndex, clickCount),
                svg,
              ),
          });
        }
        if (!isCaptured(localIndex)) {
          failed.add(localIndex);
          console.warn(
            `[slides] Could not capture slide ${localIndex} of ${importId}`,
          );
        }
      }
      if (!cancelled) setDone(true);
    })().catch((error) => {
      if (!(error instanceof CaptureCancelled)) {
        console.warn("[slides] Slide capture failed", error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loaded, done, fetchId, importId]);

  if (done) return null;

  return (
    <div
      aria-hidden
      data-testid="slide-capturer"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: 960,
        height: 540,
        opacity: 0,
        zIndex: -1,
        pointerEvents: "none",
      }}
    >
      <RenderView ref={viewRef} src={src} onLoad={() => setLoaded(true)} />
    </div>
  );
};
