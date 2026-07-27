import { RefObject, useCallback, useEffect, useRef, useState } from "react";

import { RenderViewHandle } from "./RenderView";

type UseIframeSyncArgs = {
  ref: RefObject<RenderViewHandle | null>;
  loaded: boolean;
  targetSlideIndex: number;
  targetClickCount: number;
  /**
   * Monotonic position within THIS deck that increases by one for every
   * arrow-key step (in-slide build OR slide-to-slide transition). -1 when the
   * deck is not the active one.
   */
  targetFlatPosition: number;
  /**
   * Controller's boundary-window end time (epoch ms, server clock). Set to 0 as
   * a skip trigger; otherwise `transitionEndsAt - lastClickTimestamp` is the
   * current step's animation length (skew-free, both stamps from one call).
   */
  transitionEndsAt: number;
  /** Controller's timestamp for the last key press (epoch ms, server clock). */
  lastClickTimestamp: number;
};

// Spacing between arrow-key presses when a jump fires several in a row
const STEP_MS = 50;

export const useIframeSync = ({
  ref,
  loaded,
  targetSlideIndex,
  targetClickCount,
  targetFlatPosition,
  transitionEndsAt,
  lastClickTimestamp,
}: UseIframeSyncArgs) => {
  const [localFlatPosition, setLocalFlatPosition] = useState(-1);
  const [initialized, setInitialized] = useState(false);

  // Epoch (OUR clock) after which the current step's animation has finished.
  // Non-zero also means "a window is armed at this step".
  const boundaryEndsAtRef = useRef(0);

  // Click count actually applied to the iframe. Tracked separately because
  // clickCount -1 (the autoplay-rewind sub-step) shares a flat position with 0.
  const localClickCountRef = useRef(0);

  // Land at an arbitrary position: goToSlide lands on click count 0, then step to the
  // target click count. Negative click count is the autoplay-rewind sub-step.
  const jumpToPosition = useCallback(
    (slideIndex: number, clickCount: number) => {
      ref.current?.goToSlide(slideIndex);
      if (clickCount < 0) {
        for (let i = 0; i < -clickCount; i++) {
          setTimeout(() => ref.current?.prev(), STEP_MS * (i + 1));
        }
      } else {
        for (let i = 0; i < clickCount; i++) {
          setTimeout(() => ref.current?.next(), STEP_MS * (i + 1));
        }
      }
    },
    [ref],
  );

  // Initialize once loaded
  useEffect(() => {
    if (!loaded || initialized) return;
    if (targetSlideIndex >= 0) {
      jumpToPosition(targetSlideIndex, targetClickCount);
      setLocalFlatPosition(targetFlatPosition);
      localClickCountRef.current = targetClickCount;
    }
    setInitialized(true);
  }, [
    loaded,
    initialized,
    targetSlideIndex,
    targetClickCount,
    targetFlatPosition,
    jumpToPosition,
  ]);

  // Keep the iframe in sync with the target position.
  useEffect(() => {
    if (!initialized) return;

    // Deck not active. Forget our position so re-entry re-jumps cleanly.
    if (targetSlideIndex < 0 || targetFlatPosition < 0) {
      if (localFlatPosition !== -1) {
        setLocalFlatPosition(-1);
        boundaryEndsAtRef.current = 0;
        localClickCountRef.current = 0;
      }
      return;
    }

    const delta = targetFlatPosition - localFlatPosition;

    if (delta === 0) {
      // Autoplay-rewind sub-step (0 <-> -1): invisible to the flat delta, so
      // drive it with a single arrow key.
      if (targetClickCount !== localClickCountRef.current) {
        if (targetClickCount < localClickCountRef.current) {
          ref.current?.prev();
        } else {
          ref.current?.next();
        }
        localClickCountRef.current = targetClickCount;
        boundaryEndsAtRef.current = 0;
        return;
      }

      // Skip: the controller closed an armed window (transitionEndsAt -> 0) to
      // finish the current transition without advancing. Gated by our own clock.
      if (
        transitionEndsAt === 0 &&
        boundaryEndsAtRef.current > 0 &&
        Date.now() < boundaryEndsAtRef.current
      ) {
        boundaryEndsAtRef.current = 0;
        ref.current?.next();
      }
      return;
    }

    // A single adjacent step is one arrow key (so the animation plays); anything
    // else is a discontinuity and lands directly.
    const sequential = Math.abs(delta) === 1 && localFlatPosition >= 0;
    if (!sequential) {
      jumpToPosition(targetSlideIndex, targetClickCount);
      boundaryEndsAtRef.current = 0;
    } else if (delta === 1) {
      ref.current?.next();
      const durationMs = transitionEndsAt - lastClickTimestamp;
      boundaryEndsAtRef.current = durationMs > 0 ? Date.now() + durationMs : 0;
    } else {
      ref.current?.prev();
      boundaryEndsAtRef.current = 0;
    }

    setLocalFlatPosition(targetFlatPosition);
    localClickCountRef.current = targetClickCount;
  }, [
    initialized,
    targetSlideIndex,
    targetClickCount,
    targetFlatPosition,
    transitionEndsAt,
    lastClickTimestamp,
    localFlatPosition,
    ref,
    jumpToPosition,
  ]);
};
