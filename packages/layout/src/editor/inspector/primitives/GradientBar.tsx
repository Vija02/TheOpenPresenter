import { useCallback, useEffect, useRef, useState } from "react";

import { LinearGradientPaint, sortGradientStops } from "../../../schema/paint";

export type GradientStop = LinearGradientPaint["stops"][number];

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export const roundOffset = (v: number) =>
  Math.round(clamp(v, 0, 1) * 100) / 100;

const sortStops = sortGradientStops;

export const rampCss = (stops: GradientStop[]): string => {
  const sorted = sortStops(stops);
  const first = sorted[0];
  if (!first) return "transparent";
  // A one-stop gradient is invalid CSS and would drop the background entirely.
  if (sorted.length === 1) return first.color;
  return `linear-gradient(90deg, ${sorted
    .map((s) => `${s.color} ${s.offset * 100}%`)
    .join(", ")})`;
};

type Rgba = [number, number, number, number];

const parseHex = (color: string): Rgba | null => {
  const match = /^#([0-9a-f]{3,8})$/i.exec(color.trim());
  const hex = match?.[1];
  if (!hex) return null;

  const pair = (s: string) => parseInt(s.length === 1 ? s + s : s, 16);

  if (hex.length === 3 || hex.length === 4) {
    return [
      pair(hex.slice(0, 1)),
      pair(hex.slice(1, 2)),
      pair(hex.slice(2, 3)),
      hex.length === 4 ? pair(hex.slice(3, 4)) : 255,
    ];
  }
  if (hex.length === 6 || hex.length === 8) {
    return [
      pair(hex.slice(0, 2)),
      pair(hex.slice(2, 4)),
      pair(hex.slice(4, 6)),
      hex.length === 8 ? pair(hex.slice(6, 8)) : 255,
    ];
  }
  return null;
};

const toHex = ([r, g, b, a]: Rgba): string => {
  const part = (n: number) =>
    Math.round(clamp(n, 0, 255))
      .toString(16)
      .padStart(2, "0");
  const rgb = `#${part(r)}${part(g)}${part(b)}`;
  return a >= 255 ? rgb : `${rgb}${part(a)}`;
};

export const colorAt = (stops: GradientStop[], offset: number): string => {
  const sorted = sortStops(stops);
  const first = sorted[0];
  if (!first) return "#ffffff";
  const last = sorted[sorted.length - 1] ?? first;
  if (offset <= first.offset) return first.color;
  if (offset >= last.offset) return last.color;

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (!a || !b) break;
    if (offset < a.offset || offset > b.offset) continue;

    const span = b.offset - a.offset;
    const t = span <= 0 ? 0 : (offset - a.offset) / span;
    const ca = parseHex(a.color);
    const cb = parseHex(b.color);
    if (!ca || !cb) return a.color;

    const mix = (x: number, y: number) => x + (y - x) * t;
    return toHex([
      mix(ca[0], cb[0]),
      mix(ca[1], cb[1]),
      mix(ca[2], cb[2]),
      mix(ca[3], cb[3]),
    ]);
  }
  return first.color;
};

export const GradientBar = ({
  stops,
  selected,
  onSelect,
  onMove,
  onAdd,
}: {
  stops: GradientStop[];
  selected: number;
  onSelect: (index: number) => void;
  onMove: (index: number, offset: number) => number;
  onAdd: (offset: number) => number;
}) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const lastOffset = useRef<number | null>(null);

  // Kept in a ref so the drag listeners never need re-subscribing: the
  // callbacks close over the document and so change identity every render.
  const handlers = useRef({ onMove, onSelect });
  handlers.current = { onMove, onSelect };

  const offsetAt = useCallback((clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    return roundOffset((clientX - rect.left) / rect.width);
  }, []);

  const focusStop = (index: number) =>
    barRef.current
      ?.querySelector<HTMLElement>(`[data-stop="${index}"]`)
      ?.focus({ preventScroll: true });

  useEffect(() => {
    if (!dragging) return;

    const move = (event: PointerEvent) => {
      const index = dragIndex.current;
      if (index === null) return;
      event.preventDefault();

      const offset = offsetAt(event.clientX);
      if (offset === lastOffset.current) return;
      lastOffset.current = offset;

      const next = handlers.current.onMove(index, offset);
      dragIndex.current = next;
      handlers.current.onSelect(next);
    };

    const end = () => {
      dragIndex.current = null;
      lastOffset.current = null;
      setDragging(false);
    };

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [dragging, offsetAt]);

  const startDrag = (index: number, offset: number) => {
    dragIndex.current = index;
    lastOffset.current = offset;
    setDragging(true);
  };

  const onBarPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const offset = offsetAt(event.clientX);
    const index = onAdd(offset);
    onSelect(index);
    // Continue straight into a drag, so click-and-drag places a stop in one go.
    startDrag(index, offset);
  };

  const onStopKeyDown = (index: number) => (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 0.1 : 0.01;
    const delta =
      event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    if (delta === 0) return;

    // The editor surface nudges the selected element with the arrow keys.
    event.preventDefault();
    event.stopPropagation();

    const current = stops[index];
    if (!current) return;
    const next = onMove(index, roundOffset(current.offset + delta));
    onSelect(next);
    if (next !== index) focusStop(next);
  };

  return (
    <div className="px-2.5 pb-1 pt-3">
      <div
        ref={barRef}
        onPointerDown={onBarPointerDown}
        title="Click to add a stop"
        className="lay--gradient-track checkerboard relative h-5 w-full cursor-copy touch-none select-none rounded-sm border border-stroke"
      >
        <div
          className="absolute inset-0 rounded-[2px]"
          style={{ background: rampCss(stops) }}
        />
        {stops.map((stop, index) => {
          const active = index === selected;
          return (
            <button
              key={index}
              type="button"
              data-stop={index}
              aria-label={`Gradient stop ${index + 1}, ${Math.round(
                stop.offset * 100,
              )}%`}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                onSelect(index);
                startDrag(index, stop.offset);
              }}
              onKeyDown={onStopKeyDown(index)}
              className="group absolute top-0 grid size-7 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none place-items-center focus:outline-none"
              style={{ left: `${stop.offset * 100}%` }}
            >
              <span
                className={`block rounded-full border-2 transition-transform group-active:scale-125 ${
                  active
                    ? "size-[18px] scale-110 border-accent"
                    : "size-4 border-white"
                }`}
                style={{
                  background: stop.color,
                  boxShadow: active
                    ? "0 0 0 1.5px rgba(255,255,255,0.95), 0 2px 5px rgba(0,0,0,0.4)"
                    : "0 0 0 1px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.35)",
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};
