// No API key needed: the family list is the metadata fonts.google.com uses,
// the files come from the public css2 API.

const METADATA_URL = "https://fonts.google.com/metadata/fonts";
const CSS_URL = "https://fonts.googleapis.com/css2";
const FETCH_TIMEOUT_MS = 20_000;
const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

// Google picks the format from the user agent; a current browser gets woff2.
const MODERN_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

export type FontCategory = "sans" | "serif" | "display" | "mono";

export type GoogleFontFamily = {
  family: string;
  category: FontCategory;
  /** eg `400`, `700i` */
  styles: string[];
  weightAxis: { min: number; max: number } | null;
  googleCategory: string;
  axisCount: number;
  designers: string[];
  /** 1 is the most used. */
  popularity: number;
  /** ISO 15924, eg "Thai". Empty for Latin. */
  primaryScript: string;
  hasLatin: boolean;
};

type RawFamily = {
  family: string;
  category: string;
  fonts: Record<string, unknown>;
  axes?: { tag: string; min: number; max: number }[];
  designers?: string[];
  popularity?: number;
  primaryScript?: string;
  subsets?: string[];
};

const CATEGORIES: Record<string, FontCategory> = {
  "Sans Serif": "sans",
  Serif: "serif",
  Display: "display",
  Handwriting: "display",
  Monospace: "mono",
};

export const parseCatalog = (body: string): GoogleFontFamily[] => {
  // Skip any anti-hijacking prefix such as `)]}'`
  const json = JSON.parse(body.slice(body.indexOf("{"))) as {
    familyMetadataList: RawFamily[];
  };
  return json.familyMetadataList.map((f) => {
    const wght = f.axes?.find((a) => a.tag === "wght");
    return {
      family: f.family,
      category: CATEGORIES[f.category] ?? "sans",
      styles: Object.keys(f.fonts),
      weightAxis: wght ? { min: wght.min, max: wght.max } : null,
      googleCategory: f.category,
      axisCount: f.axes?.length ?? 0,
      designers: f.designers ?? [],
      popularity: f.popularity ?? Number.MAX_SAFE_INTEGER,
      primaryScript: f.primaryScript ?? "",
      hasLatin: f.subsets?.includes("latin") ?? true,
    };
  });
};

let catalog: { at: number; families: GoogleFontFamily[] } | null = null;

export const getGoogleFontCatalog = async (
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleFontFamily[]> => {
  if (catalog && Date.now() - catalog.at < CATALOG_TTL_MS) {
    return catalog.families;
  }
  const res = await fetchImpl(METADATA_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (res.status !== 200) {
    throw new Error(`Google Fonts responded ${res.status}`);
  }
  const families = parseCatalog(await res.text());
  catalog = { at: Date.now(), families };
  return families;
};

/** Every weight and style. Axes other than weight stay at their default. */
export const css2FamilyParam = (font: GoogleFontFamily): string => {
  const italic = font.styles.some((s) => s.endsWith("i"));
  const name = font.family.replace(/ /g, "+");

  if (font.weightAxis) {
    const range = `${font.weightAxis.min}..${font.weightAxis.max}`;
    return italic
      ? `${name}:ital,wght@0,${range};1,${range}`
      : `${name}:wght@${range}`;
  }

  // css2 rejects unsorted tuples
  const tuples = font.styles
    .map((s) => ({ ital: s.endsWith("i") ? 1 : 0, wght: parseInt(s, 10) }))
    .filter((t) => !Number.isNaN(t.wght))
    .sort((a, b) => a.ital - b.ital || a.wght - b.wght);
  return italic
    ? `${name}:ital,wght@${tuples.map((t) => `${t.ital},${t.wght}`).join(";")}`
    : `${name}:wght@${tuples.map((t) => t.wght).join(";")}`;
};

export const fetchGoogleFontCss = async (
  font: GoogleFontFamily,
  fetchImpl: typeof fetch = fetch,
): Promise<string> => {
  const url = `${CSS_URL}?family=${css2FamilyParam(font)}&display=swap`;
  const res = await fetchImpl(url, {
    headers: { "user-agent": MODERN_USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (res.status !== 200) {
    throw new Error(`Google Fonts responded ${res.status}`);
  }
  return res.text();
};

/** Same in the client. */
export const PREVIEW_FAMILY_SUFFIX = " Preview";
const MAX_PREVIEW_TEXT = 300;

/**
 * Only the glyphs of `text`, renamed to `<family> Preview` so this cut-down
 * face can't stand in for the organization's own copy.
 */
export const fetchGooglePreviewCss = async (
  family: string,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> => {
  const chars = [...new Set(text.slice(0, MAX_PREVIEW_TEXT))].join("");
  const url = `${CSS_URL}?family=${encodeURIComponent(family)}&text=${encodeURIComponent(chars)}&display=swap`;
  const res = await fetchImpl(url, {
    headers: { "user-agent": MODERN_USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (res.status !== 200) {
    throw new Error(`Google Fonts responded ${res.status}`);
  }
  return renamePreviewFamily(await res.text(), family);
};

export const renamePreviewFamily = (css: string, family: string) => {
  const renamed = `${family}${PREVIEW_FAMILY_SUFFIX}`.replace(/['"\\]/g, "");
  return css.replace(
    /font-family:\s*(['"])?[^;'"]*\1\s*;/g,
    `font-family: '${renamed}';`,
  );
};

const FONT_FILE_URL =
  /url\((https:\/\/fonts\.gstatic\.com\/[^)\s'"]+\.(woff2|woff|ttf|otf))\)/g;

export const extractFontFileUrls = (css: string): string[] => [
  ...new Set([...css.matchAll(FONT_FILE_URL)].map((m) => m[1]!)),
];

export const rewriteFontFileUrls = (
  css: string,
  replacements: Map<string, string>,
): string =>
  css.replace(FONT_FILE_URL, (match, url: string) => {
    const local = replacements.get(url);
    return local ? `url(${local})` : match;
  });

export const fileExtensionOf = (url: string): string =>
  url.slice(url.lastIndexOf(".") + 1);

export const downloadFontFile = async (
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Buffer> => {
  const res = await fetchImpl(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (res.status !== 200) {
    throw new Error(`Font file responded ${res.status}`);
  }
  const body = Buffer.from(await res.arrayBuffer());
  if (body.byteLength > MAX_FILE_BYTES) {
    throw new Error(`Font file too large (${body.byteLength} bytes)`);
  }
  return body;
};

/** At most `limit` at a time, keeping order. */
export const mapLimited = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let next = 0;
  let failure: { error: unknown } | null = null;
  const worker = async () => {
    // After a failure, start nothing new but let running work finish, so the
    // caller can clean up all of it
    while (!failure && next < items.length) {
      const index = next++;
      try {
        results[index] = await fn(items[index]!);
      } catch (error) {
        failure ??= { error };
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  if (failure) throw (failure as { error: unknown }).error;
  return results;
};
