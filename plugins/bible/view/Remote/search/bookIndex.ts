import { BibleBookIndex, BibleBookMeta } from "../../../src/types";

/** Normalise for matching: trim, lowercase, collapse internal whitespace. */
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Split a reference into book + trailing chapter/verse, e.g. "1 John 3:16"
 *  -> { bookPart: "1 John", tail: "3:16" }. Uses `\D` so non-Latin scripts work. */
export const splitReference = (
  input: string,
): { bookPart: string; tail: string } => {
  const m = input.match(/^\s*((?:[1-3]\s*)?\D+?)\s*(\d.*)?$/);
  return {
    bookPart: (m?.[1] ?? "").trim(),
    tail: (m?.[2] ?? "").trim(),
  };
};

/** Does `book` match query `q` by exact/prefix on its name or any abbrev? */
const bookMatches = (
  book: BibleBookMeta,
  q: string,
): "exact" | "prefix" | "includes" | null => {
  const candidates = [book.name, ...book.abbr].map(norm);
  if (candidates.some((c) => c === q)) return "exact";
  if (candidates.some((c) => c.startsWith(q))) return "prefix";
  if (candidates.some((c) => c.includes(q))) return "includes";
  return null;
};

/**
 * Resolve a free-form book string to a book in this translation's index.
 * Tries exact, then prefix, then substring across native names + abbreviations.
 */
export const matchBookInIndex = (
  index: BibleBookIndex,
  raw: string,
): BibleBookMeta | null => {
  const q = norm(raw);
  if (!q) return null;

  const exact = index.find((b) => bookMatches(b, q) === "exact");
  if (exact) return exact;

  const prefix = index.find((b) => bookMatches(b, q) === "prefix");
  if (prefix) return prefix;

  const includes = index.find((b) => bookMatches(b, q) === "includes");
  return includes ?? null;
};

/** Autocomplete book suggestions. Returns [] once a chapter number is typed;
 *  prefix matches rank before substring, capped at `limit`. */
export const suggestBooks = (
  index: BibleBookIndex,
  input: string,
  limit = 8,
): BibleBookMeta[] => {
  const { bookPart, tail } = splitReference(input);
  if (!bookPart || tail) return [];
  const q = norm(bookPart);
  if (!q) return [];

  const prefix: BibleBookMeta[] = [];
  const includes: BibleBookMeta[] = [];
  for (const b of index) {
    const kind = bookMatches(b, q);
    if (kind === "exact" || kind === "prefix") prefix.push(b);
    else if (kind === "includes") includes.push(b);
  }
  const all = [...prefix, ...includes];

  // Nothing useful to add if the sole match already equals the query.
  if (all.length === 1 && norm(all[0]!.name) === q) return [];
  return all.slice(0, limit);
};

export type ParsedIndexReference = {
  book: BibleBookMeta;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
};

/** Parse a reference against the book index, e.g. "John 3:16-18". Single-chapter
 *  books resolve "Jude 3" as verse 3 of chapter 1 (not chapter 3). */
export const parseReferenceInIndex = (
  index: BibleBookIndex,
  input: string,
): ParsedIndexReference | null => {
  const { bookPart, tail } = splitReference(input);
  const book = matchBookInIndex(index, bookPart);
  if (!book) return null;

  // Bare book with no chapter/verse -> whole first chapter.
  if (!tail) return { book, chapter: 1 };

  const normalized = tail.replace(/[\u2013\u2014]/g, "-").trim();
  const m = normalized.match(/^(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?$/);
  if (!m) return null;

  const first = parseInt(m[1]!, 10);
  const hasColon = m[2] != null;
  const isSingleChapter = book.chapters.length === 1;

  if (!hasColon && isSingleChapter) {
    // "Jude 3" / "Jude 3-5" -> verse(s) of the single chapter.
    const verseStart = first;
    const verseEnd = m[3] ? parseInt(m[3], 10) : undefined;
    return { book, chapter: 1, verseStart, verseEnd };
  }

  const chapter = first;
  const verseStart = m[2] ? parseInt(m[2], 10) : undefined;
  const verseEnd = m[3] ? parseInt(m[3], 10) : undefined;
  return { book, chapter, verseStart, verseEnd };
};

/** Build a canonical display reference string. */
export const buildReference = (
  bookName: string,
  chapter: number,
  verseStart?: number,
  verseEnd?: number,
): string => {
  let out = `${bookName} ${chapter}`;
  if (verseStart != null) {
    out += `:${verseStart}`;
    if (verseEnd != null && verseEnd !== verseStart) out += `-${verseEnd}`;
  }
  return out;
};
