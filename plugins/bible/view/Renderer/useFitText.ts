import { useLayoutEffect, useRef, useState } from "react";

type FitTextOptions = {
  text: string;
  /** Width of the bounding box in px */
  width: number;
  /** Height of the bounding box in px */
  height: number;
  fontFamily: string;
  fontWeight: number | string;
  lineHeight: number;
  minFontSize?: number;
  maxFontSize?: number;
};

/**
 * Returns the largest font size (px) at which `text`, wrapped by word, fits
 * within a `width` x `height` box
 *
 * Measurement is done against a detached, hidden element that mirrors the
 * wrapping rules of the rendered text
 */
export const useFitText = ({
  text,
  width,
  height,
  fontFamily,
  fontWeight,
  lineHeight,
  minFontSize = 6,
  maxFontSize = 800,
}: FitTextOptions): number => {
  const [fontSize, setFontSize] = useState(minFontSize);
  const measureRef = useRef<HTMLDivElement | null>(null);

  // Create / tear down the shared measuring node.
  useLayoutEffect(() => {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "absolute",
      visibility: "hidden",
      pointerEvents: "none",
      left: "-99999px",
      top: "0",
      margin: "0",
      padding: "0",
      whiteSpace: "normal",
      wordBreak: "break-word",
      overflowWrap: "break-word",
      boxSizing: "border-box",
    } as CSSStyleDeclaration);
    document.body.appendChild(el);
    measureRef.current = el;
    return () => {
      el.remove();
      measureRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el || width <= 0 || height <= 0 || !text) {
      return;
    }

    el.style.width = `${width}px`;
    el.style.fontFamily = fontFamily;
    el.style.fontWeight = String(fontWeight);
    el.style.lineHeight = String(lineHeight);
    el.textContent = text;

    const fits = (fs: number) => {
      el.style.fontSize = `${fs}px`;
      // +0.5 tolerance to avoid sub-pixel jitter forcing an extra shrink.
      return el.scrollHeight <= height + 0.5 && el.scrollWidth <= width + 0.5;
    };

    let lo = minFontSize;
    let hi = Math.min(maxFontSize, height);

    // Binary search for the largest size that still fits.
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    setFontSize(Math.max(minFontSize, Math.floor(lo)));
  }, [
    text,
    width,
    height,
    fontFamily,
    fontWeight,
    lineHeight,
    minFontSize,
    maxFontSize,
  ]);

  return fontSize;
};
