/**
 * Derive a short caption label from a translation name.
 *   "English NIV"          -> "NIV"   (explicit acronym token)
 *   "World English Bible"  -> "WEB"   (initials)
 *   "King James Version"   -> "KJV"
 * Prefers an all-caps acronym word (must start with a letter, so a year like
 * "1960" isn't mistaken for one); otherwise falls back to the initials.
 */
export const deriveAbbreviation = (name: string): string => {
  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return name;

  const acronym = tokens.find((t) => /^[A-Z][A-Z0-9]{1,5}$/.test(t));
  if (acronym) return acronym;

  const initials = tokens
    .map((t) => t[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 5);
  return initials || name.slice(0, 6).toUpperCase();
};
