import { useSyncExternalStore } from "react";

import { captureKey, captureStore } from "./captureStore";

/**
 * The captured picture of a Google Slides position, or undefined while it
 * isn't ready (or the slide isn't shown through the Google Slides embed).
 */
export const useSlideCapture = (
  position: {
    fetchId: string;
    localSlideIndex: number;
    clickCount: number;
  } | null,
) =>
  useSyncExternalStore(captureStore.subscribe, () =>
    position
      ? captureStore.get(
          captureKey(
            position.fetchId,
            position.localSlideIndex,
            position.clickCount,
          ),
        )
      : undefined,
  );
