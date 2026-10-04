import { useSyncExternalStore } from "react";

const PORTRAIT_QUERY = "(orientation: portrait)";

const subscribe = (onChange: () => void) => {
  const list = window.matchMedia(PORTRAIT_QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
};

export const useIsPortrait = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PORTRAIT_QUERY).matches,
    () => false,
  );
