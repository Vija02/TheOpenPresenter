/** The same server, however it was written down. */
export function sameHost(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const strip = (value: string) =>
    value
      .trim()
      .replace(/\/+$/, "")
      .replace(/^https?:\/\//i, "")
      .toLowerCase();
  return strip(a) === strip(b);
}
