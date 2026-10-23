import { isScreenRenderer } from "@repo/base-plugin";
import { captureEvent } from "@repo/observability/initAnalytics";
import { useAwareness } from "@repo/shared";
import { useEffect, useRef } from "react";
import { toast } from "react-toastify";

import { previewPanelStore } from "../contexts/previewPanel";
import { useIsMobile } from "./useIsMobile";

const ATTEMPT_COUNT = 3;
const ATTEMPT_WINDOW_MS = 5000;
const SLIDE_SELECTOR = '[data-testid="slide-container"]';

/**
 * New users can get confused on how the system works. One way to alleviate this
 * is by detecting when they click the slide too much, expecting it to do something.
 *
 * When it happens, simply show the preview
 */
export const useNoOutputHint = () => {
  const { awarenessData } = useAwareness();

  const hasRendererRef = useRef(false);
  hasRendererRef.current = awarenessData.some((x) => isScreenRenderer(x.user));

  // The hint is opening the preview, which phones don't have
  const isMobileRef = useRef(false);
  isMobileRef.current = useIsMobile();

  useEffect(() => {
    let lastSlide: Element | null = null;
    let attempts: number[] = [];
    let hasHinted = false;

    const onClick = (event: MouseEvent) => {
      if (hasHinted || isMobileRef.current) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const slide = target.closest(SLIDE_SELECTOR);
      if (!slide) return;

      const isPreviewOpen = previewPanelStore.getState().isOpen;
      if (hasRendererRef.current || isPreviewOpen) {
        attempts = [];
        return;
      }

      const now = Date.now();
      if (slide !== lastSlide) {
        lastSlide = slide;
        attempts = [now];
        return;
      }

      attempts = [...attempts, now].filter(
        (time) => now - time < ATTEMPT_WINDOW_MS,
      );

      if (attempts.length < ATTEMPT_COUNT) {
        if (attempts.length === 2) {
          captureEvent("slide_repeat_clicked");
        }
        return;
      }

      hasHinted = true;
      attempts = [];
      captureEvent("no_output_hint_shown", { click_count: ATTEMPT_COUNT });
      previewPanelStore.getState().open("no_output_hint");
      toast.info(
        "Nothing is on a screen yet. This preview shows what your audience would see. Hit Present when you're ready.",
      );
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
};
