import { RefObject, useCallback, useEffect, useState } from "react";

import { RenderViewHandle } from "./RenderView";

type UseIframeSyncArgs = {
  ref: RefObject<RenderViewHandle | null>;
  loaded: boolean;
  targetSlideIndex: number;
  targetClickCount: number;
};

export const useIframeSync = ({
  ref,
  loaded,
  targetSlideIndex,
  targetClickCount,
}: UseIframeSyncArgs) => {
  const [localSlideIndex, setLocalSlideIndex] = useState(-1);
  const [localClickCount, setLocalClickCount] = useState(0);
  const [initialized, setInitialized] = useState(false);

  const stepClicks = useCallback(
    (n: number) => {
      const count = Math.abs(n);
      const goingForward = n > 0;
      for (let i = 0; i < count; i++) {
        setTimeout(
          () => {
            if (goingForward) {
              ref.current?.next();
            } else {
              ref.current?.prev();
            }
          },
          50 * (i + 1),
        );
      }
    },
    [ref],
  );

  // Initialize the iframe to the target position once loaded
  useEffect(() => {
    if (!loaded || initialized) return;
    if (targetSlideIndex >= 0) {
      ref.current?.goToSlide(targetSlideIndex);
      setLocalSlideIndex(targetSlideIndex);
      if (targetClickCount > 0) {
        stepClicks(targetClickCount);
        setLocalClickCount(targetClickCount);
      }
    }
    setInitialized(true);
  }, [
    loaded,
    initialized,
    targetSlideIndex,
    targetClickCount,
    stepClicks,
    ref,
  ]);

  // Keep the iframe in sync with the target
  useEffect(() => {
    if (!initialized) return;
    if (targetSlideIndex < 0) return;

    if (targetSlideIndex !== localSlideIndex) {
      ref.current?.goToSlide(targetSlideIndex);
      setLocalSlideIndex(targetSlideIndex);
      setLocalClickCount(0);
      if (targetClickCount > 0) {
        stepClicks(targetClickCount);
        setLocalClickCount(targetClickCount);
      }
    } else if (targetClickCount !== localClickCount) {
      stepClicks(targetClickCount - localClickCount);
      setLocalClickCount(targetClickCount);
    }
  }, [
    initialized,
    targetSlideIndex,
    targetClickCount,
    localSlideIndex,
    localClickCount,
    stepClicks,
    ref,
  ]);
};
