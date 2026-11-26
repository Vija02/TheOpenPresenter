import * as React from "react";

/** Open dialogs and sheets using it, so the last one to close clears it */
let users = 0;

/** Sets `--keyboard-inset` and `--visible-height` on the page while enabled */
export const useKeyboardInset = (enabled = true) => {
  React.useEffect(() => {
    const viewport = window.visualViewport;
    if (!enabled || !viewport) return;

    const root = document.documentElement;
    const update = () => {
      // The keyboard shrinks only the visual viewport
      const inset = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      root.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
      root.style.setProperty(
        "--visible-height",
        `${Math.round(viewport.height)}px`,
      );
    };

    users++;
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      if (--users > 0) return;
      root.style.removeProperty("--keyboard-inset");
      root.style.removeProperty("--visible-height");
    };
  }, [enabled]);
};

/** Rendered inside a dialog or sheet, so it only runs while that's open */
export const KeyboardInset = () => {
  useKeyboardInset();
  return null;
};
