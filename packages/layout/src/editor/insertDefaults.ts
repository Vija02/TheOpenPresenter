import { LayoutElement, LayoutElementType } from "../schema/element";
import { FillPaint } from "../schema/paint";

/** Arrays are replaced in one go. Objects merge key by key. */
export type DeepPatch<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPatch<T[K]> }
    : T;

export type LayoutInsertDefaults = {
  elements?: {
    [T in LayoutElementType]?: DeepPatch<Extract<LayoutElement, { type: T }>>;
  };
  fills?: {
    [T in FillPaint["type"]]?: DeepPatch<Extract<FillPaint, { type: T }>>;
  };
};

export const NO_INSERT_DEFAULTS: LayoutInsertDefaults = {};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Returns `base` itself when the patch changes nothing */
export function mergePatch<T>(base: T, patch: unknown): T {
  if (!isPlainObject(patch) || !isPlainObject(base)) return base;

  let out: Record<string, unknown> = base;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = out[key];
    const merged =
      isPlainObject(value) && isPlainObject(current)
        ? mergePatch(current, value)
        : value;
    if (merged === current) continue;
    out = { ...out, [key]: merged };
  }
  return out as T;
}

export const applyFillDefaults = <P extends FillPaint | null>(
  defaults: LayoutInsertDefaults,
  paint: P,
): P => (paint ? mergePatch(paint, defaults.fills?.[paint.type]) : paint);

/** Patches the element, then its fill, so both layers can be overridden. */
export const applyInsertDefaults = <E extends LayoutElement>(
  defaults: LayoutInsertDefaults,
  element: E,
): E => {
  const patched = mergePatch(element, defaults.elements?.[element.type]);
  const fill = applyFillDefaults(defaults, patched.fill);
  return fill === patched.fill ? patched : { ...patched, fill };
};
