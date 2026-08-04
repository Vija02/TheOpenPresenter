import { useCallback, useSyncExternalStore } from "react";

/**
 * `--breakpoint-desktop` in @repo/tailwind-config, which is also what the apps'
 * `useIsMobile` uses.
 */
export const DESKTOP_QUERY = "(min-width: 48rem)";

export const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onStoreChange);
      return () => list.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () =>
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia(query).matches
        : false,
    () => false,
  );
};

export const useIsCompact = (): boolean => !useMediaQuery(DESKTOP_QUERY);
