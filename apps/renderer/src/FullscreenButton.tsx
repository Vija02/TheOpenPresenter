import { useCallback, useEffect, useRef, useState } from "react";

/** How long the button stays visible after the pointer stops moving. */
const HIDE_AFTER_MS = 1500;

/**
 * Manual fullscreen toggle, parked in the bottom-right corner.
 */
export const FullscreenButton = () => {
  const [visible, setVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reveal = () => {
      setVisible(true);
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
      hideTimeout.current = setTimeout(() => setVisible(false), HIDE_AFTER_MS);
    };

    window.addEventListener("pointermove", reveal);
    return () => {
      window.removeEventListener("pointermove", reveal);
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, []);

  useEffect(() => {
    const syncFullscreen = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));

    document.addEventListener("fullscreenchange", syncFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  // Fullscreen is unavailable in some embedded webviews.
  if (!document.documentElement.requestFullscreen) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={isFullscreen ? "Exit fullscreen" : "Go fullscreen"}
      aria-label={isFullscreen ? "Exit fullscreen" : "Go fullscreen"}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-4 right-4 z-50 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white transition-opacity duration-200 hover:bg-black/70 focus-visible:opacity-100 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-6 w-6"
        aria-hidden="true"
      >
        {isFullscreen ? (
          <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
        ) : (
          <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
        )}
      </svg>
    </button>
  );
};
