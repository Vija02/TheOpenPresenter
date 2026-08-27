import { captureEvent } from "@repo/observability/initAnalytics";
import { usePluginMetaData } from "@repo/shared";
import { useOverlayToggle } from "@repo/ui";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MdClose, MdFullscreen, MdVolumeOff, MdVolumeUp } from "react-icons/md";
import { useSearch } from "wouter";

import { useRendererSelection } from "../../contexts/rendererSelection";

const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 200;
const MAX_WIDTH = 960;
const HEADER_HEIGHT = 28;
const MARGIN = 16;

const bodyHeightFor = (width: number) => Math.round((width * 9) / 16);
const totalHeightFor = (width: number) => HEADER_HEIGHT + bodyHeightFor(width);

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const PreviewWindow = () => {
  const { isOpen, onToggle } = useOverlayToggle();
  const { orgSlug, projectSlug } = usePluginMetaData();
  const search = useSearch();
  const { selectedRendererId } = useRendererSelection();

  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [position, setPosition] = useState(() => ({
    x: Math.max(MARGIN, window.innerWidth - DEFAULT_WIDTH - MARGIN),
    y: Math.max(
      MARGIN,
      window.innerHeight - totalHeightFor(DEFAULT_WIDTH) - MARGIN,
    ),
  }));
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  // The renderer installs its mute before any plugin runs, so it starts muted.
  const [isMuted, setIsMuted] = useState(true);
  // Offset between the pointer and the window's top-left corner.
  const grabOffset = useRef<{ x: number; y: number } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (isOpen) {
      captureEvent("preview_opened");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const bodyHeight = bodyHeightFor(width);
  const totalHeight = totalHeightFor(width);

  const rendererParam = `renderer=${selectedRendererId}&preview=1`;
  const renderUrl = search
    ? `/render/${orgSlug}/${projectSlug}?${search}&${rendererParam}`
    : `/render/${orgSlug}/${projectSlug}?${rendererParam}`;

  const handleFullscreen = () => {
    iframeRef.current?.requestFullscreen().catch(() => {});
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    iframeRef.current?.contentWindow?.postMessage(
      { type: "preview:setMuted", muted: next },
      window.location.origin,
    );
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    grabOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    setIsDragging(true);
    // Keeps events coming to the header even as the pointer passes over the
    // iframe, which would otherwise swallow them.
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const offset = grabOffset.current;
    if (!offset) return;

    setPosition({
      x: clamp(e.clientX - offset.x, 0, window.innerWidth - width),
      y: clamp(e.clientY - offset.y, 0, window.innerHeight - totalHeight),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    grabOffset.current = null;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsResizing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing) return;

    // Only width is driven; height follows from the aspect ratio
    const maxByViewport = Math.min(
      window.innerWidth - position.x,
      ((window.innerHeight - position.y - HEADER_HEIGHT) * 16) / 9,
    );

    setWidth(
      clamp(
        e.clientX - position.x,
        MIN_WIDTH,
        Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, maxByViewport)),
      ),
    );
  };

  const handleResizeEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsResizing(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return createPortal(
    <div
      data-testid="preview-window"
      className="fixed z-[90] overflow-hidden rounded-sm border border-black/20 bg-black shadow-lg"
      style={{ left: position.x, top: position.y, width }}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        data-testid="preview-window-header"
        className={`flex items-center justify-between gap-2 bg-neutral-800 px-2 text-white select-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ height: HEADER_HEIGHT }}
      >
        <span className="min-w-0 truncate text-xs font-medium text-white/70">
          Preview
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          <span className="mr-1 flex items-center gap-1.5 text-xs font-medium">
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"
              aria-hidden="true"
            />
            <span className="tracking-wide text-red-400 uppercase">Live</span>
          </span>
          <button
            type="button"
            onClick={handleToggleMute}
            onPointerDown={(e) => e.stopPropagation()}
            title={isMuted ? "Unmute" : "Mute"}
            aria-label={isMuted ? "Unmute" : "Mute"}
            className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            {isMuted ? <MdVolumeOff /> : <MdVolumeUp />}
          </button>
          <button
            type="button"
            onClick={handleFullscreen}
            onPointerDown={(e) => e.stopPropagation()}
            title="Fullscreen"
            aria-label="Fullscreen"
            className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <MdFullscreen />
          </button>
          <button
            type="button"
            onClick={onToggle}
            onPointerDown={(e) => e.stopPropagation()}
            title="Close preview"
            aria-label="Close preview"
            className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <MdClose />
          </button>
        </span>
      </div>
      <iframe
        ref={iframeRef}
        src={renderUrl}
        title="Renderer preview"
        className="block w-full border-0"
        style={{
          height: bodyHeight,
          pointerEvents: isDragging || isResizing ? "none" : "auto",
        }}
      />
      <div
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
        title="Resize"
        className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize"
      >
        <span
          className="pointer-events-none absolute right-1 bottom-1 h-2 w-2 border-r-2 border-b-2 border-white/60"
          aria-hidden="true"
        />
      </div>
    </div>,
    document.body,
  );
};

export default PreviewWindow;
