import { useEffect, useState } from "react";

/** Matches `transition-fade-in`/`transition-fade-out` */
const FADE_MS = 300;
/** Lets a running animation end on its own before its class is swapped */
const SETTLE_MARGIN_MS = 50;

// Handles fading. On startup, just show directly
export const useFade = (
  visible: boolean,
  { exitDelayMs = 0 }: { exitDelayMs?: number } = {},
) => {
  const [fade, setFade] = useState({ visible, animating: false });

  // Set while rendering so the first frame after a change is already fading
  if (fade.visible !== visible) {
    setFade({ visible, animating: true });
  }

  useEffect(() => {
    if (!fade.animating) return;

    const timeout = setTimeout(
      () => setFade((current) => ({ ...current, animating: false })),
      FADE_MS + (fade.visible ? 0 : exitDelayMs) + SETTLE_MARGIN_MS,
    );
    return () => clearTimeout(timeout);
  }, [fade, exitDelayMs]);

  const className = fade.animating
    ? fade.visible
      ? "transition-fade-in"
      : "transition-fade-out"
    : fade.visible
      ? "opacity-100"
      : "opacity-0";

  return {
    className,
    isRendered: fade.visible || fade.animating,
  };
};
