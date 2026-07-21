import axios from "axios";
// Type-only import
import type {
  ApiAvailableTranslations,
  ApiTranslation,
  ApiTranslationBookChapter,
  ApiTranslationBooks,
  ChapterVerse,
} from "free-use-bible-api";

import { getStandardBooks } from "../builtin/versification";
import { BibleBookIndex, BibleBookMeta, LookupResult } from "../types";
import { numberToUsfm, usfmToNumber } from "./usfm";

const BASE = "https://bible.helloao.org/api";
const TIMEOUT = 15_000;

export type HelloaoTranslation = ApiTranslation;

// --- Catalog (cached for the process lifetime) --------------------------------
let catalogCache: HelloaoTranslation[] | null = null;
let catalogInFlight: Promise<HelloaoTranslation[]> | null = null;

export const fetchHelloaoCatalog = async (): Promise<HelloaoTranslation[]> => {
  if (catalogCache) return catalogCache;
  if (catalogInFlight) return catalogInFlight;
  catalogInFlight = axios
    .get<ApiAvailableTranslations>(`${BASE}/available_translations.json`, {
      timeout: TIMEOUT,
    })
    .then((res) => {
      catalogCache = res.data?.translations ?? [];
      return catalogCache;
    })
    .finally(() => {
      catalogInFlight = null;
    });
  return catalogInFlight;
};

/** Look up one helloao translation's metadata from the cached catalog. */
export const getHelloaoTranslation = async (
  translationId: string,
): Promise<HelloaoTranslation | undefined> => {
  const all = await fetchHelloaoCatalog();
  return all.find((t) => t.id === translationId);
};

// --- Book index ---------------------------------------------------------------

/**
 * Build a BibleBookIndex for a helloao translation
 */
export const fetchHelloaoBooks = async (
  translationId: string,
): Promise<BibleBookIndex> => {
  const res = await axios.get<ApiTranslationBooks>(
    `${BASE}/${encodeURIComponent(translationId)}/books.json`,
    { timeout: TIMEOUT },
  );
  const standard = getStandardBooks();
  const books: BibleBookMeta[] = [];

  for (const b of res.data?.books ?? []) {
    if (b.isApocryphal) continue; // apocrypha / deuterocanon not supported
    const n = usfmToNumber(b.id);
    if (!n) continue; // non-canonical id we can't number/resolve
    const abbr = Array.from(
      new Set([b.name, b.commonName, b.id].filter(Boolean) as string[]),
    );
    books.push({
      n,
      name: b.name,
      abbr,
      chapters: standard[n - 1]?.chapters ?? [],
    });
  }

  books.sort((a, b) => a.n - b.n);
  return books;
};

// --- Passage resolution -------------------------------------------------------

/**
 * Render a verse's content to plain text. Verse content is
 * `Array<string | FormattedText | InlineHeading | InlineLineBreak |
 * VerseFootnoteReference>`; only strings and FormattedText carry verse text —
 * inline headings ({heading}), line breaks ({lineBreak}) and footnote markers
 * ({noteId}) are deliberately dropped.
 */
const renderVerse = (verse: ChapterVerse): string => {
  const parts: string[] = [];
  for (const c of verse.content) {
    if (typeof c === "string") parts.push(c);
    else if ("text" in c && typeof c.text === "string") parts.push(c.text);
  }
  return parts
    .join(" ")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const resolveHelloaoPassage = async ({
  translationId,
  bookName,
  bookNumber,
  chapter,
  verseStart,
  verseEnd,
}: {
  translationId: string;
  bookName: string;
  bookNumber: number;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
}): Promise<LookupResult> => {
  const usfm = numberToUsfm(bookNumber);
  if (!usfm) throw new Error(`Unknown book number ${bookNumber}`);

  const meta = await getHelloaoTranslation(translationId);

  const res = await axios.get<ApiTranslationBookChapter>(
    `${BASE}/${encodeURIComponent(translationId)}/${usfm}/${chapter}.json`,
    { timeout: TIMEOUT, validateStatus: (s) => s < 500 },
  );
  const content = res.data?.chapter?.content;
  if (!content || !Array.isArray(content)) {
    throw new Error(`${bookName} ${chapter} is not in this translation`);
  }

  let verses = content
    .filter((c): c is ChapterVerse => c.type === "verse")
    .map((v) => ({ v: v.number, t: renderVerse(v) }))
    .filter((x) => x.t.length > 0);

  if (verseStart != null) {
    const end = verseEnd ?? verseStart;
    verses = verses.filter((x) => x.v >= verseStart && x.v <= end);
  }
  if (verses.length === 0) {
    throw new Error(`No verses found for ${bookName} ${chapter}`);
  }

  const refVerses =
    verseStart != null
      ? `${chapter}:${verseStart}${
          verseEnd != null && verseEnd !== verseStart ? `-${verseEnd}` : ""
        }`
      : `${chapter}`;

  return {
    reference: `${bookName} ${refVerses}`,
    translationId,
    translationName: meta?.name ?? translationId,
    translationAbbreviation:
      meta?.shortName ?? meta?.englishName ?? translationId.toUpperCase(),
    verses: verses.map((x) => ({
      bookId: usfm,
      bookName,
      chapter,
      verse: x.v,
      text: x.t,
    })),
  };
};
