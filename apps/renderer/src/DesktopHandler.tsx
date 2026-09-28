import { desktop } from "@repo/desktop-bridge";
import { useEffect } from "react";

/**
 * Escape closes a presentation window.
 *
 * Only relevant in a Tauri shell: the Electron shell registers Escape in the
 * main process, where it works even if the page has stolen focus, and a
 * browser tab has nothing to close.
 */
export const DesktopHandler = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    if (desktop.host !== "tauri") return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        void desktop.closeSelf();
      }
    };

    document.body.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return children;
};

export default DesktopHandler;
