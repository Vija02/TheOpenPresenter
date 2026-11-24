import { subscribeToMissingFonts } from "@repo/layout";
import { useEffect, useRef } from "react";

const MIN_INTERVAL_MS = 10_000;

// Handles for when a new font is added, but this renderer is not refreshed yet
export const useRefetchWhenFontsMissing = (refetch: () => void) => {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      timer = null;
      last = Date.now();
      refetchRef.current();
    };
    const unsubscribe = subscribeToMissingFonts(() => {
      if (timer) return;
      const wait = last + MIN_INTERVAL_MS - Date.now();
      if (wait <= 0) run();
      else timer = setTimeout(run, wait);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);
};
