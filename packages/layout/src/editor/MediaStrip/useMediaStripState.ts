import {
  PointerEvent as ReactPointerEvent,
  RefObject,
  useEffect,
  useRef,
  useState,
} from "react";

const HEIGHT_KEY = "lay--media-height";
const MIN_HEIGHT = 96;
const DEFAULT_HEIGHT = 240;
/** Dragged shorter than this, the panel closes */
const CLOSE_BELOW = 64;
/** Less movement than this is a click, not a drag */
const DRAG_SLOP = 3;

const readStoredHeight = () => {
  try {
    const stored = Number(localStorage.getItem(HEIGHT_KEY));
    return stored >= MIN_HEIGHT ? stored : DEFAULT_HEIGHT;
  } catch {
    return DEFAULT_HEIGHT;
  }
};

export type MediaStripState = ReturnType<typeof useMediaStripState>;

/**
 * Whether the media panel is open, and how tall. Dragged from the handle
 * above it when open, or from the bar it leaves when closed. Dragging nearly
 * shut closes it, and dragging up from closed opens it. The height is
 * remembered per browser
 */
export const useMediaStripState = (
  rootRef: RefObject<HTMLDivElement | null>,
  /** Compact and desktop each mount their own root */
  compact: boolean,
  startOpen: boolean,
) => {
  const [open, setOpen] = useState(startOpen);
  const [stored, setStored] = useState(readStoredHeight);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ y: 0, height: 0 });
  const movedRef = useRef(false);
  const latestRef = useRef({ open, height: stored });
  const [, setRootHeight] = useState(0);

  // A height saved in a taller window must still leave room for the canvas
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setRootHeight(root.clientHeight));
    observer.observe(root);
    return () => observer.disconnect();
  }, [rootRef, compact]);

  const clamp = (next: number) => {
    const root = rootRef.current?.clientHeight ?? 0;
    const max = root > 0 ? Math.max(MIN_HEIGHT, root * 0.6) : next;
    return Math.round(Math.max(MIN_HEIGHT, Math.min(next, max)));
  };

  const height = clamp(stored);
  latestRef.current = { open, height };

  const finish = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
    if (!latestRef.current.open) return;
    try {
      localStorage.setItem(HEIGHT_KEY, String(latestRef.current.height));
    } catch {
      // Not remembered, which is fine
    }
  };

  const dragProps = {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      startRef.current = { y: e.clientY, height: open ? height : 0 };
      movedRef.current = false;
      setDragging(true);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      if (!dragging) return;
      const dy = e.clientY - startRef.current.y;
      if (Math.abs(dy) < DRAG_SLOP && !movedRef.current) return;
      movedRef.current = true;

      const raw = startRef.current.height - dy;
      if (raw < CLOSE_BELOW) {
        latestRef.current = { ...latestRef.current, open: false };
        setOpen(false);
        return;
      }
      const next = clamp(raw);
      latestRef.current = { open: true, height: next };
      setOpen(true);
      setStored(next);
    },
    onPointerUp: finish,
    onPointerCancel: finish,
  };

  /**
   * Opening with a click, not a drag: at least the default height, as
   * dragging it shut leaves the remembered height at its smallest
   */
  const show = () => {
    setStored((current) => Math.max(current, DEFAULT_HEIGHT));
    setOpen(true);
  };

  /** For the closed bar: a click that wasn't the end of a drag opens it */
  const onBarClick = () => {
    if (!movedRef.current) show();
    movedRef.current = false;
  };

  return { open, setOpen, show, height, dragging, dragProps, onBarClick };
};
