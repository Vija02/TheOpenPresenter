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
  videoFinishAt?: (
    slideIndex: number,
    clickCount: number,
  ) => "right" | "rightLeft" | null;
};

// Spacing between arrow-key presses when a jump fires several in a row
const STEP_MS = 50;
// After a step has started, before finishing the video it plays
const FINISH_DELAY_MS = 100;

export const useIframeSync = ({
  ref,
  loaded,
  targetSlideIndex,
  targetClickCount,
  targetFlatPosition,
  transitionEndsAt,
  lastClickTimestamp,
  videoFinishAt,
}: UseIframeSyncArgs) => {
  const [localFlatPosition, setLocalFlatPosition] = useState(-1);
  const [initialized, setInitialized] = useState(false);

  // Epoch (OUR clock) after which the current step's animation has finished.
  // Non-zero also means "a window is armed at this step".
  const boundaryEndsAtRef = useRef(0);
  // The key that finishes that step without moving: Right for a forward
  // step, Left for a backward slide transition (Right would cancel it).
  const boundarySkipKeyRef = useRef<"next" | "prev">("next");

  // Click count actually applied to the iframe. Tracked separately because
  // clickCount -1 (the autoplay-rewind sub-step) shares a flat position with 0.
  const localClickCountRef = useRef(0);

  // Read through a ref, so a new function doesn't re-run the sync
  const videoFinishAtRef = useRef(videoFinishAt);
  videoFinishAtRef.current = videoFinishAt;

  // The keys that will finish a video the embed just started
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelFinish = useCallback(() => {
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    finishTimerRef.current = null;
  }, []);
  const scheduleFinish = useCallback(
    (slideIndex: number, clickCount: number, afterMs: number) => {
      cancelFinish();
      const keys = videoFinishAtRef.current?.(slideIndex, clickCount);
      if (!keys) return;
      finishTimerRef.current = setTimeout(() => {
        finishTimerRef.current = null;
        ref.current?.next();
        if (keys === "rightLeft") {
          finishTimerRef.current = setTimeout(() => {
            finishTimerRef.current = null;
            ref.current?.prev();
          }, STEP_MS);
        }
      }, afterMs + FINISH_DELAY_MS);
    },
    [cancelFinish, ref],
  );
  useEffect(() => cancelFinish, [cancelFinish]);

  // Land at an arbitrary position: goToSlide lands on click count 0, then step to the
  // target click count. Negative click count is the autoplay-rewind sub-step.
  const jumpToPosition = useCallback(
    (slideIndex: number, clickCount: number) => {
      cancelFinish();
      ref.current?.goToSlide(slideIndex);
      if (clickCount < 0) {
        for (let i = 0; i < -clickCount; i++) {
          setTimeout(() => ref.current?.prev(), STEP_MS * (i + 1));
        }
      } else {
        for (let i = 0; i < clickCount; i++) {
          setTimeout(() => ref.current?.next(), STEP_MS * (i + 1));
        }
        scheduleFinish(slideIndex, clickCount, STEP_MS * (clickCount + 1));
      }
    },
    [ref, cancelFinish, scheduleFinish],
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
        cancelFinish();
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
        cancelFinish();
        if (targetClickCount < localClickCountRef.current) {
          ref.current?.prev();
        } else {
          ref.current?.next();
          // Plays the automatic objects again, a video among them maybe
          scheduleFinish(targetSlideIndex, targetClickCount, STEP_MS);
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
        cancelFinish();
        if (boundarySkipKeyRef.current === "prev") {
          ref.current?.prev();
        } else {
          ref.current?.next();
          scheduleFinish(targetSlideIndex, targetClickCount, 0);
        }
      }
      return;
    }

    // A single adjacent step is one arrow key (so the animation plays); anything
    // else is a discontinuity and lands directly.
    const sequential = Math.abs(delta) === 1 && localFlatPosition >= 0;
    if (!sequential) {
      jumpToPosition(targetSlideIndex, targetClickCount);
      boundaryEndsAtRef.current = 0;
    } else {
      cancelFinish();
      if (delta === 1) {
        ref.current?.next();
      } else {
        ref.current?.prev();
      }
      // Only slide transitions have a window going backwards: builds are
      // removed instantly, and the controller closes the window for them
      const durationMs = transitionEndsAt - lastClickTimestamp;
      // Going back doesn't replay a video; going forward may start one. Its
      // step takes no time, but a transition before it must play out first
      if (delta === 1) {
        scheduleFinish(
          targetSlideIndex,
          targetClickCount,
          Math.max(0, durationMs),
        );
      }
      boundaryEndsAtRef.current = durationMs > 0 ? Date.now() + durationMs : 0;
      boundarySkipKeyRef.current = delta === 1 ? "next" : "prev";
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
    cancelFinish,
    scheduleFinish,
  ]);
};
