import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MdClose } from "react-icons/md";

/** How long the close button lingers after the pointer stops moving. */
const HIDE_AFTER_MS = 1500;

type PresentOverlayProps = {
  renderUrl: string;
  onClose: () => void;
};

/**
 * Shows the renderer on top of the remote
 */
const PresentOverlay = ({ renderUrl, onClose }: PresentOverlayProps) => {
  const [controlsVisible, setControlsVisible] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reveal = () => {
      setControlsVisible(true);
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
      hideTimeout.current = setTimeout(
        () => setControlsVisible(false),
        HIDE_AFTER_MS,
      );
    };

    reveal();
    document.addEventListener("pointermove", reveal);

    // The iframe eats pointer events, so the document above never sees the
    // cursor move over the presentation
    let innerDoc: Document | null = null;
    const attachInner = () => {
      try {
        const doc = iframeRef.current?.contentDocument ?? null;
        if (doc === innerDoc) return;
        innerDoc?.removeEventListener("pointermove", reveal);
        innerDoc = doc;
        innerDoc?.addEventListener("pointermove", reveal);
      } catch {
        // Cross-origin
      }
    };

    const iframe = iframeRef.current;
    iframe?.addEventListener("load", attachInner);
    attachInner();

    return () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
      document.removeEventListener("pointermove", reveal);
      iframe?.removeEventListener("load", attachInner);
      try {
        innerDoc?.removeEventListener("pointermove", reveal);
      } catch {
        // The iframe document may already be gone.
      }
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black">
      <iframe
        ref={iframeRef}
        src={renderUrl}
        title="Presentation"
        className="w-full h-full border-0"
        allow="autoplay; fullscreen"
      />
      <button
        type="button"
        onClick={onClose}
        title="Stop presenting"
        aria-label="Stop presenting"
        aria-hidden={!controlsVisible}
        tabIndex={controlsVisible ? 0 : -1}
        className={`absolute top-3 right-3 flex items-center justify-center w-9 h-9 rounded-full bg-black/50 text-white transition-opacity duration-200 cursor-pointer hover:bg-black/70 focus-visible:opacity-100 ${
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <MdClose />
      </button>
    </div>,
    document.body,
  );
};

export default PresentOverlay;
