import type { UniversalURL } from "@repo/lib";

import {
  FrameData,
  Span,
  TokenValue,
  compactSpans,
  isSpanArray,
  span,
} from "./spans";

/**
 * Dots are allowed so plugins can namespace keys (`song.title`), but lookup is
 * flat. Nested access would be the first step toward an expression language.
 */
const TOKEN_PATTERN = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;

/** Every token key referenced by a template string, in order, deduplicated. */
export const extractTokenKeys = (template: string): string[] => {
  const keys: string[] = [];
  for (const match of template.matchAll(TOKEN_PATTERN)) {
    const key = match[1];
    if (key !== undefined && !keys.includes(key)) keys.push(key);
  }
  return keys;
};

export type TemplateSegment =
  | { type: "text"; text: string }
  | { type: "token"; text: string; key: string };

/**
 * Split a template into literal and token runs, for editor highlighting.
 */
export const splitTemplate = (template: string): TemplateSegment[] => {
  const out: TemplateSegment[] = [];
  let cursor = 0;

  for (const match of template.matchAll(TOKEN_PATTERN)) {
    const start = match.index;
    const whole = match[0];
    const key = match[1];
    if (start === undefined || whole === undefined || key === undefined)
      continue;

    if (start > cursor) {
      out.push({ type: "text", text: template.slice(cursor, start) });
    }
    out.push({ type: "token", text: whole, key });
    cursor = start + whole.length;
  }

  if (cursor < template.length) {
    out.push({ type: "text", text: template.slice(cursor) });
  }

  return out;
};

const scalarToString = (value: TokenValue): string => {
  if (value === null || value === undefined) return "";
  if (isSpanArray(value)) return value.map((s) => s.text).join("");
  // An InternalMedia in a text slot is a binding type error. Empty beats
  // rendering "[object Object]" on a live output.
  if (typeof value === "object") return "";
  return String(value);
};

/** For fields that cannot carry styling. */
export const substituteText = (template: string, data: FrameData): string =>
  template.replace(TOKEN_PATTERN, (_, key: string) =>
    scalarToString(data[key]),
  );

/**
 * Literal text becomes role-less spans; a `Span[]` value splices in with its
 * roles intact. The template never sees the data's structure, and the plugin
 * never sees the appearance.
 */
export const substituteSpans = (template: string, data: FrameData): Span[] => {
  const out: Span[] = [];
  let cursor = 0;

  for (const match of template.matchAll(TOKEN_PATTERN)) {
    const start = match.index;
    const whole = match[0];
    const key = match[1];
    if (start === undefined || whole === undefined || key === undefined)
      continue;

    if (start > cursor) out.push(span(template.slice(cursor, start)));

    const value = data[key];
    if (isSpanArray(value)) {
      out.push(...value);
    } else {
      const text = scalarToString(value);
      if (text !== "") out.push(span(text));
    }

    cursor = start + whole.length;
  }

  if (cursor < template.length) out.push(span(template.slice(cursor)));

  return compactSpans(out);
};

const WHOLE_TOKEN = /^\s*\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}\s*$/;

export const substituteUniversalURL = (
  src: UniversalURL,
  data: FrameData,
): UniversalURL => {
  if (typeof src !== "string") return src;

  const key = src.match(WHOLE_TOKEN)?.[1];
  if (key !== undefined) {
    const value = data[key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      return value;
    }
  }

  return substituteText(src, data);
};

/**
 * Tokens referenced by a template but absent from the supplied data. The editor
 * surfaces these as warnings; rendering treats them as empty.
 */
export const findUnboundTokens = (
  template: string,
  data: FrameData,
): string[] =>
  extractTokenKeys(template).filter(
    (key) => data[key] === undefined || data[key] === null,
  );
