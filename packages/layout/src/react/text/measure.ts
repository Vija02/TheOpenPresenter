import { hash } from "ohash";

import { SpanRoleStyle } from "../../schema/style";
import { Span } from "../../template/spans";
import { getFontGeneration } from "./fontStatus";

export type MeasureSpec = {
  /** Markup mirroring what will actually render, so wrapping matches. */
  html: string;
  width: number;
  height: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: string;
  lineHeight: number;
  /** px */
  letterSpacing: number;
};

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Span sizes are emitted in `em` so a single root font size drives the whole
 * block. That is what lets the fit be one binary search rather than one per
 * span, and it keeps measurement identical to render.
 */
export const spansToHtml = (
  spans: Span[],
  roles: Record<string, SpanRoleStyle> | null,
): string =>
  spans
    .map((s) => {
      const role = s.role !== null ? roles?.[s.role] : undefined;
      const text = escapeHtml(s.text);
      if (!role) return text;

      const css = [
        role.fontScale !== undefined ? `font-size:${role.fontScale}em` : "",
        role.verticalAlign !== undefined
          ? `vertical-align:${role.verticalAlign}`
          : "",
        role.fontWeight !== undefined ? `font-weight:${role.fontWeight}` : "",
        role.fontStyle !== undefined ? `font-style:${role.fontStyle}` : "",
        role.fontFamily !== undefined ? `font-family:${role.fontFamily}` : "",
        role.marginAfter !== undefined
          ? `margin-right:${role.marginAfter}em`
          : "",
      ]
        .filter(Boolean)
        .join(";");

      return css ? `<span style="${css}">${text}</span>` : text;
    })
    .join("");

let measureNode: HTMLDivElement | null = null;

const getMeasureNode = (): HTMLDivElement => {
  if (measureNode) return measureNode;
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
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
  measureNode = el;
  return el;
};

const CACHE_LIMIT = 500;
const cache = new Map<string, number>();

const remember = (key: string, value: number): number => {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
  return value;
};

export type FitOptions = {
  minFontSize?: number;
  maxFontSize?: number;
};

/**
 * Largest font size in px at which the markup fits the box.
 *
 * Runs synchronously during render so the first paint is already correct.
 * Results are cached, so a grid of thumbnails at one size measures once per
 * distinct slide rather than once per mount.
 */
export const fitFontSize = (
  spec: MeasureSpec,
  { minFontSize = 6, maxFontSize = 800 }: FitOptions = {},
): number => {
  if (typeof document === "undefined") return minFontSize;
  if (spec.width <= 0 || spec.height <= 0 || spec.html === "") {
    return minFontSize;
  }

  const key = hash({
    spec,
    minFontSize,
    maxFontSize,
    fonts: getFontGeneration(),
  });
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const el = getMeasureNode();
  el.style.width = `${spec.width}px`;
  el.style.fontFamily = spec.fontFamily;
  el.style.fontWeight = String(spec.fontWeight);
  el.style.fontStyle = spec.fontStyle;
  el.style.lineHeight = String(spec.lineHeight);
  el.style.letterSpacing = `${spec.letterSpacing}px`;
  el.innerHTML = spec.html;

  const fits = (size: number): boolean => {
    el.style.fontSize = `${size}px`;
    // Half a pixel of tolerance stops sub-pixel rounding forcing a shrink.
    return (
      el.scrollHeight <= spec.height + 0.5 && el.scrollWidth <= spec.width + 0.5
    );
  };

  let lo = minFontSize;
  let hi = Math.min(maxFontSize, spec.height);

  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }

  return remember(key, Math.max(minFontSize, Math.floor(lo)));
};
