/**
 * Only `undefined` means "not set". `null` is a real value and DOES override:
 * `fill: null` means "no fill", not "inherit".
 */
export const cascade = <T extends object>(
  base: T,
  ...patches: (Partial<T> | null | undefined)[]
): T => {
  const out = { ...base };
  for (const patch of patches) {
    if (!patch) continue;
    for (const key of Object.keys(patch) as (keyof T)[]) {
      const value = patch[key];
      if (value !== undefined) out[key] = value as T[keyof T];
    }
  }
  return out;
};

export type DiffOptions<T> = {
  /** Keys never treated as overrides, e.g. editor-only flags. */
  ignore?: (keyof T)[];
};

/**
 * Keys of `candidate` that actually differ from `base`. Use when saving an
 * override layer so a value equal to the inherited one isn't stored as one.
 */
export const diffOverride = <T extends object>(
  base: T,
  candidate: Partial<T>,
  options: DiffOptions<T> = {},
): Partial<T> => {
  const ignore = options.ignore ?? [];
  const out: Partial<T> = {};

  for (const key of Object.keys(candidate) as (keyof T)[]) {
    if (ignore.includes(key)) continue;
    const value = candidate[key];
    if (value === undefined) continue;
    if (!Object.is(value, base[key])) out[key] = value;
  }

  return out;
};

/** Keys where an override layer diverges from its parent. Drives override badges. */
export const overriddenKeys = <T extends object>(
  base: T,
  override: Partial<T> | null | undefined,
): (keyof T)[] => {
  if (!override) return [];
  return (Object.keys(override) as (keyof T)[]).filter((key) => {
    const value = override[key];
    return value !== undefined && !Object.is(value, base[key]);
  });
};
