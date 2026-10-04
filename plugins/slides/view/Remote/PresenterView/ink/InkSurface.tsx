import { useRef } from "react";

import { type InkTool, inkBox } from "../../../../src/ink";
import type { ResolvedSlide } from "../../../../src/types";
import { type InkPoint, useInkPen } from "./useInkPen";

/**
 * Catches the pointer over the speaker's main slide while a tool is picked.
 * What gets drawn shows up through the renderer's ink layer, here and on
 * every output.
 */
export const InkSurface = ({
  tool,
  slide,
}: {
  tool: InkTool;
  slide: ResolvedSlide | null;
}) => {
  const pen = useInkPen({ tool, slideRef: slide?.rawRef ?? null });
  const elementRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);

  const toPoint = (event: {
    clientX: number;
    clientY: number;
    pressure: number;
    pointerType: string;
  }): InkPoint | null => {
    const element = elementRef.current;
    if (!element || !slide) return null;
    const rect = element.getBoundingClientRect();
    const box = inkBox(slide, rect.width, rect.height);
    if (box.boxWidth <= 0 || box.boxHeight <= 0) return null;
    return {
      x: (event.clientX - rect.left - box.offsetX) / box.boxWidth,
      y: (event.clientY - rect.top - box.offsetY) / box.boxHeight,
      pressure: event.pointerType === "pen" ? event.pressure : 0.5,
    };
  };

  return (
    <div
      ref={elementRef}
      data-testid="speaker-ink-surface"
      className="absolute inset-0 z-[1] select-none"
      style={{ cursor: "crosshair", touchAction: "none" }}
      // A press would otherwise drag a text selection instead of drawing
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (activePointer.current !== null || event.button !== 0) return;
        event.preventDefault();
        window.getSelection()?.removeAllRanges();
        const point = toPoint(event);
        if (!point) return;
        activePointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        pen.begin(point, event.pointerType === "pen");
      }}
      onPointerMove={(event) => {
        if (event.pointerId !== activePointer.current) return;
        // Every sample since the last frame, for smooth fast strokes
        const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
        for (const sample of samples.length > 0 ? samples : [event]) {
          const point = toPoint(sample);
          if (point) pen.move(point);
        }
      }}
      onPointerUp={(event) => {
        if (event.pointerId !== activePointer.current) return;
        activePointer.current = null;
        pen.end();
      }}
      onPointerCancel={(event) => {
        if (event.pointerId !== activePointer.current) return;
        activePointer.current = null;
        pen.end();
      }}
    />
  );
};
