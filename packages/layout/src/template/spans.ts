import type { InternalMedia } from "@repo/lib";

/**
 * Plugins emit spans tagged with role names, templates style the roles. This
 * gives per-part styling.
 */
export type Span = {
  text: string;
  /** Key into the element's `spanRoles`. `null` uses the element's base style. */
  role: string | null;
};

/**
 * `undefined` is accepted on the way in, but never persisted. `InternalMedia`
 * covers `image` bindings, which cannot be expressed as a string.
 */
export type TokenValue =
  | string
  | number
  | Span[]
  | InternalMedia
  | null
  | undefined;

export type FrameData = Record<string, TokenValue>;

export const span = (text: string, role: string | null = null): Span => ({
  text,
  role,
});

export const isSpanArray = (value: TokenValue): value is Span[] =>
  Array.isArray(value);

export const spansToPlainText = (spans: Span[]): string =>
  spans.map((s) => s.text).join("");

/** Drives `hideWhenEmpty`. Whitespace only counts as empty. */
export const isSpansEmpty = (spans: Span[]): boolean =>
  spans.every((s) => s.text.trim() === "");

/** Drop empty spans and merge adjacent spans sharing a role. */
export const compactSpans = (spans: Span[]): Span[] => {
  const out: Span[] = [];
  for (const s of spans) {
    if (s.text === "") continue;
    const prev = out[out.length - 1];
    if (prev && prev.role === s.role) {
      out[out.length - 1] = { text: prev.text + s.text, role: prev.role };
    } else {
      out.push(s);
    }
  }
  return out;
};
