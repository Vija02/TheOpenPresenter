// Only the sample text's glyphs, renamed by our server to `<family> Preview`
// so a cut-down preview can't stand in for the organization's own copy

const CSS_URL = "/fonts/google-preview.css";
/** Same as `PREVIEW_FAMILY_SUFFIX` on the server. */
const PREVIEW_SUFFIX = " Preview";

export const previewFamilyName = (family: string) =>
  `${family}${PREVIEW_SUFFIX}`.replace(/['"\\]/g, "");

const loads = new Map<string, Promise<boolean>>();
const links = new Set<HTMLLinkElement>();

const uniqueChars = (text: string) => [...new Set(text)].join("");

export const loadGoogleFontPreview = (
  family: string,
  text: string,
): Promise<boolean> => {
  const chars = uniqueChars(text);
  const key = `${family}\n${chars}`;
  const existing = loads.get(key);
  if (existing) return existing;

  const ready = new Promise<boolean>((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.dataset.fontPreview = family;
    link.href = `${CSS_URL}?family=${encodeURIComponent(family)}&text=${encodeURIComponent(chars)}&display=swap`;
    link.onload = () => {
      document.fonts
        .load(`1em "${previewFamilyName(family)}"`, chars)
        .then(() => resolve(true))
        .catch(() => resolve(false));
    };
    link.onerror = () => {
      loads.delete(key);
      link.remove();
      links.delete(link);
      resolve(false);
    };
    links.add(link);
    document.head.appendChild(link);
  });
  loads.set(key, ready);
  return ready;
};

export const clearGoogleFontPreviews = () => {
  for (const link of links) link.remove();
  links.clear();
  loads.clear();
};
