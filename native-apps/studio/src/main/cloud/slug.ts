import slugify from "slugify";

export function toSlug(name: string): string {
  const base = slugify(name, { lower: true, strict: true }).slice(0, 48);

  // Every slug has to be non-empty and start with a letter.
  if (!base || !/^[a-z]/.test(base)) {
    return `org-${base || "1"}`.slice(0, 48);
  }
  return base;
}

/** A slug not already taken on this server. */
export function uniqueSlug(desired: string, taken: string[]): string {
  if (!taken.includes(desired)) return desired;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${desired.slice(0, 44)}-${n}`;
    if (!taken.includes(candidate)) return candidate;
  }
  // Practically unreachable, but a caller must never get a duplicate.
  return `${desired.slice(0, 40)}-${Date.now().toString(36)}`;
}
