import { useCallback, useSyncExternalStore } from "react";

/** Tailwind's `md` (`--breakpoint-desktop`); narrower than this is a phone */
const DESKTOP_QUERY = "(min-width: 48rem)";

/** The one check for phone-sized screens, shared by every app and package */
export const useIsMobile = (): boolean => {
  const subscribe = useCallback((onChange: () => void) => {
    if (typeof window === "undefined" || !window.matchMedia) return () => {};
    const list = window.matchMedia(DESKTOP_QUERY);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, []);

  return useSyncExternalStore(
    subscribe,
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      !window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
};
