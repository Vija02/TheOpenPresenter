import { deriveAbbreviation } from "../../../src/helpers/abbreviation";
import { matchBookInIndex } from "../search/bookIndex";
import { canonicalBookName, getStandardBooks } from "../../../src/builtin/versification";
import type { ChapterInput } from "../../../src/storage/types";
import { BibleBookMeta } from "../../../src/types";

/** Parsed uploaded Bible XML, shaped for the translations.create mutation. */
export type ParsedTranslation = {
  name: string;
  abbreviation: string | null;
  language: string;
  format: string;
  books: BibleBookMeta[];
  chapters: ChapterInput[];
};

const cleanText = (text: string | null) =>
  (text ?? "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// OSIS book codes in canonical order -> 1-based book number.
const OSIS_CODES = [
  "Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "Ruth", "1Sam",
  "2Sam", "1Kgs", "2Kgs", "1Chr", "2Chr", "Ezra", "Neh", "Esth", "Job",
  "Ps", "Prov", "Eccl", "Song", "Isa", "Jer", "Lam", "Ezek", "Dan", "Hos",
  "Joel", "Amos", "Obad", "Jonah", "Mic", "Nah", "Hab", "Zeph", "Hag",
  "Zech", "Mal", "Matt", "Mark", "Luke", "John", "Acts", "Rom", "1Cor",
  "2Cor", "Gal", "Eph", "Phil", "Col", "1Thess", "2Thess", "1Tim", "2Tim",
  "Titus", "Phlm", "Heb", "Jas", "1Pet", "2Pet", "1John", "2John", "3John",
  "Jude", "Rev",
];
const osisToNumber: Record<string, number> = Object.fromEntries(
  OSIS_CODES.map((code, i) => [code.toLowerCase(), i + 1]),
);

/** Resolve a raw book name to a canonical 1..66 number, or null. */
const numberFromName = (raw: string | null): number | null => {
  if (!raw) return null;
  return matchBookInIndex(getStandardBooks(), raw)?.n ?? null;
};

type RawBook = {
  n: number;
  nativeName: string;
  chapters: Map<number, Map<number, string>>;
};
type RawBible = Map<number, RawBook>;

const ensureBook = (raw: RawBible, n: number, nativeName: string): RawBook => {
  let rb = raw.get(n);
  if (!rb) {
    rb = { n, nativeName, chapters: new Map() };
    raw.set(n, rb);
  } else if (nativeName && !rb.nativeName) {
    rb.nativeName = nativeName;
  }
  return rb;
};

const setVerse = (
  rb: RawBook,
  chapter: number,
  verse: number,
  text: string,
) => {
  if (!chapter || !verse || !text) return;
  let ch = rb.chapters.get(chapter);
  if (!ch) {
    ch = new Map();
    rb.chapters.set(chapter, ch);
  }
  ch.set(verse, text);
};

// --- Zefania: <XMLBIBLE><BIBLEBOOK bnumber bname><CHAPTER cnumber><VERS vnumber>
const parseZefania = (doc: Document): RawBible => {
  const raw: RawBible = new Map();
  Array.from(doc.getElementsByTagName("BIBLEBOOK")).forEach((bookEl, i) => {
    const bnum = parseInt(bookEl.getAttribute("bnumber") ?? "", 10);
    const bname = bookEl.getAttribute("bname");
    const n = !Number.isNaN(bnum) ? bnum : numberFromName(bname) ?? i + 1;
    if (n < 1 || n > 66) return;
    const rb = ensureBook(raw, n, (bname ?? "").trim() || canonicalBookName(n) || "");
    for (const chapEl of Array.from(bookEl.getElementsByTagName("CHAPTER"))) {
      const chapter = parseInt(chapEl.getAttribute("cnumber") ?? "", 10);
      if (Number.isNaN(chapter)) continue;
      for (const vEl of Array.from(chapEl.getElementsByTagName("VERS"))) {
        const verse = parseInt(vEl.getAttribute("vnumber") ?? "", 10);
        if (Number.isNaN(verse)) continue;
        setVerse(rb, chapter, verse, cleanText(vEl.textContent));
      }
    }
  });
  return raw;
};

// --- OpenSong: <bible><b n><c n><v n>
const parseOpenSong = (doc: Document): RawBible => {
  const raw: RawBible = new Map();
  Array.from(doc.getElementsByTagName("b")).forEach((bookEl, i) => {
    const bname = bookEl.getAttribute("n");
    const n = numberFromName(bname) ?? i + 1;
    if (n < 1 || n > 66) return;
    const rb = ensureBook(raw, n, (bname ?? "").trim() || canonicalBookName(n) || "");
    for (const chapEl of Array.from(bookEl.getElementsByTagName("c"))) {
      const chapter = parseInt(chapEl.getAttribute("n") ?? "", 10);
      if (Number.isNaN(chapter)) continue;
      for (const vEl of Array.from(chapEl.getElementsByTagName("v"))) {
        const verse = parseInt(vEl.getAttribute("n") ?? "", 10);
        if (Number.isNaN(verse)) continue;
        setVerse(rb, chapter, verse, cleanText(vEl.textContent));
      }
    }
  });
  return raw;
};

// --- Beblia: <bible><testament name><book number><chapter number><verse number>
// Books are numbered continuously 1..66; there is no per-book name attribute,
// so the display name falls back to the canonical English name.
const parseBeblia = (doc: Document): RawBible => {
  const raw: RawBible = new Map();
  for (const bookEl of Array.from(doc.getElementsByTagName("book"))) {
    const bnum = parseInt(bookEl.getAttribute("number") ?? "", 10);
    if (Number.isNaN(bnum) || bnum < 1 || bnum > 66) continue;
    const rb = ensureBook(raw, bnum, canonicalBookName(bnum) || "");
    for (const chapEl of Array.from(bookEl.getElementsByTagName("chapter"))) {
      const chapter = parseInt(chapEl.getAttribute("number") ?? "", 10);
      if (Number.isNaN(chapter)) continue;
      for (const vEl of Array.from(chapEl.getElementsByTagName("verse"))) {
        const verse = parseInt(vEl.getAttribute("number") ?? "", 10);
        if (Number.isNaN(verse)) continue;
        setVerse(rb, chapter, verse, cleanText(vEl.textContent));
      }
    }
  }
  return raw;
};

// --- OSIS: <verse osisID="John.3.16">text</verse>
const parseOsis = (doc: Document): RawBible => {
  const raw: RawBible = new Map();
  const verseEls = Array.from(doc.getElementsByTagName("verse")).filter((v) =>
    v.getAttribute("osisID"),
  );
  for (const vEl of verseEls) {
    const osisId = vEl.getAttribute("osisID")!;
    const first = osisId.split(/\s+/)[0]!;
    const parts = first.split(".");
    if (parts.length < 3) continue;
    const [code, chapStr, verseStr] = parts;
    const n = osisToNumber[code!.toLowerCase()] ?? numberFromName(code!);
    const chapter = parseInt(chapStr!, 10);
    const verse = parseInt(verseStr!, 10);
    if (!n || Number.isNaN(chapter) || Number.isNaN(verse)) continue;
    const rb = ensureBook(raw, n, canonicalBookName(n) || "");
    setVerse(rb, chapter, verse, cleanText(vEl.textContent));
  }
  return raw;
};

// --- USX (Paratext / DBL / unfoldingWord): books keyed by USFM code (GEN...);
// verses are milestones — `<verse/>` is empty and text flows after it until the
// next verse marker. So we walk in document order tracking book/chapter/verse,
// skipping <note>s and heading paragraphs so they don't bleed into verses.
const USFM_CODES = [
  "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI",
  "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SNG",
  "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC",
  "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL", "MAT", "MRK", "LUK", "JHN", "ACT",
  "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI",
  "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV",
];
const usfmToNumber: Record<string, number> = Object.fromEntries(
  USFM_CODES.map((code, i) => [code, i + 1]),
);

// Non-verse paragraph styles whose text must not be captured as verse content.
const USX_HEADING_STYLES = new Set([
  "h", "h1", "h2", "h3", "toc1", "toc2", "toc3", "toca1", "toca2", "toca3",
  "mt", "mt1", "mt2", "mt3", "mt4", "imt", "imt1", "imt2", "ms", "ms1", "ms2",
  "ms3", "mr", "s", "s1", "s2", "s3", "s4", "sr", "r", "sp", "d", "cl", "cp",
  "rem", "lit", "iot", "io", "io1", "io2", "io3", "is", "is1", "is2", "ip",
  "im", "ib", "ie", "iex",
]);

const parseVerseNumber = (raw: string | null): number | null => {
  // Verse numbers can be "1", "1-2", "1a", "3,5"; take the leading integer.
  const m = raw?.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
};

const parseUsx = (doc: Document): RawBible => {
  const raw: RawBible = new Map();
  const root = doc.getElementsByTagName("usx")[0] ?? doc.documentElement;

  let currentN: number | null = null;
  let currentChapter: number | null = null;
  let currentVerse: number | null = null;
  const buffers = new Map<string, string>(); // `${n}:${ch}:${v}` -> text
  const nativeNames = new Map<number, string>();

  const append = (text: string) => {
    if (currentN == null || currentChapter == null || currentVerse == null) {
      return;
    }
    const key = `${currentN}:${currentChapter}:${currentVerse}`;
    buffers.set(key, (buffers.get(key) ?? "") + text);
  };

  const walk = (node: Node) => {
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 3) {
        append(child.textContent ?? "");
        continue;
      }
      if (child.nodeType !== 1) continue;
      const el = child as Element;
      const tag = el.tagName;

      if (tag === "note") continue; // footnotes / cross-references
      if (tag === "book") {
        const code = (el.getAttribute("code") ?? "").toUpperCase();
        currentN = usfmToNumber[code] ?? null;
        currentChapter = null;
        currentVerse = null;
        continue;
      }
      if (tag === "chapter") {
        const num = el.getAttribute("number");
        if (num) {
          currentChapter = parseInt(num, 10);
          currentVerse = null;
        } else if (el.getAttribute("eid")) {
          currentVerse = null;
        }
        walk(el); // no-op for milestones; handles legacy container chapters
        continue;
      }
      if (tag === "verse") {
        const num = el.getAttribute("number");
        if (num) currentVerse = parseVerseNumber(num);
        else if (el.getAttribute("eid")) currentVerse = null;
        continue;
      }
      if (tag === "para") {
        const style = el.getAttribute("style") ?? "";
        // The running header ("h") is the native book name — capture it.
        if (style === "h" && currentN != null && !nativeNames.has(currentN)) {
          const t = (el.textContent ?? "").trim();
          if (t) nativeNames.set(currentN, t);
        }
        if (USX_HEADING_STYLES.has(style)) continue;
      }
      walk(el);
    }
  };
  walk(root);

  for (const [key, text] of buffers) {
    const [n, ch, v] = key.split(":").map(Number);
    if (!n || !ch || !v) continue;
    const rb = ensureBook(
      raw,
      n,
      nativeNames.get(n) || canonicalBookName(n) || "",
    );
    setVerse(rb, ch, v, cleanText(text));
  }
  return raw;
};

const extractName = (doc: Document, fallback: string): string => {
  // USX: the <book style="id"> text is usually the translation name/description.
  const bookId = doc.querySelector("book")?.textContent?.trim();
  const candidates = [
    doc.documentElement.getAttribute("biblename"),
    doc.documentElement.getAttribute("translation"),
    bookId && bookId.length <= 64 ? bookId : null,
    doc.querySelector("INFORMATION > title")?.textContent,
    doc.querySelector("title")?.textContent,
    doc.querySelector("work > title")?.textContent,
  ];
  const found = candidates.find((c) => c && c.trim());
  return (found ?? fallback).trim();
};

const detectLanguage = (doc: Document): string => {
  const lang =
    doc.documentElement.getAttribute("lang") ||
    doc.documentElement.getAttribute("xml:lang") ||
    doc.querySelector("INFORMATION > language")?.textContent ||
    "";
  return (lang || "en").trim().slice(0, 16);
};

/** Build the upload payload: a book index (native names + per-chapter verse
 *  counts, taken as the max verse number seen) plus one entry per chapter. */
const finalize = (
  raw: RawBible,
  name: string,
  language: string,
  format: string,
): ParsedTranslation => {
  const books: BibleBookMeta[] = [];
  const chapters: ChapterInput[] = [];

  for (const n of [...raw.keys()].sort((a, b) => a - b)) {
    const rb = raw.get(n)!;
    const chapterNums = [...rb.chapters.keys()].sort((a, b) => a - b);
    if (chapterNums.length === 0) continue;

    const canonical = canonicalBookName(n) ?? rb.nativeName;
    const maxChapter = chapterNums[chapterNums.length - 1]!;
    const counts: number[] = [];

    for (let c = 1; c <= maxChapter; c++) {
      const vmap = rb.chapters.get(c);
      const maxV = vmap && vmap.size > 0 ? Math.max(...vmap.keys()) : 0;
      counts.push(maxV);
      if (vmap && vmap.size > 0) {
        const verses = [...vmap.entries()]
          .map(([v, t]) => ({ v, t }))
          .sort((a, b) => a.v - b.v);
        chapters.push({ book: canonical, bookNumber: n, chapter: c, verses });
      }
    }

    books.push({
      n,
      name: rb.nativeName || canonical,
      abbr: [],
      chapters: counts,
    });
  }

  return { name, abbreviation: deriveAbbreviation(name), language, format, books, chapters };
};

const totalVerses = (raw: RawBible): number => {
  let n = 0;
  for (const rb of raw.values())
    for (const ch of rb.chapters.values()) n += ch.size;
  return n;
};

/**
 * Parse a Bible XML string (Zefania, OpenSong, USX, OSIS, or Beblia) into a
 * ParsedTranslation ready for the translations.create mutation. Throws a
 * friendly message on failure.
 */
export const parseBibleXml = (
  xml: string,
  fallbackName: string,
): ParsedTranslation => {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("This file isn't valid XML.");
  }

  let raw: RawBible;
  let format: string;

  if (doc.getElementsByTagName("BIBLEBOOK").length > 0) {
    raw = parseZefania(doc);
    format = "zefania";
  } else if (
    doc.getElementsByTagName("b").length > 0 &&
    doc.getElementsByTagName("v").length > 0
  ) {
    raw = parseOpenSong(doc);
    format = "opensong";
  } else if (
    doc.getElementsByTagName("usx").length > 0 ||
    Array.from(doc.getElementsByTagName("book")).some((b) =>
      b.getAttribute("code"),
    )
  ) {
    // USX (Paratext / DBL / unfoldingWord): milestone verses, USFM book codes.
    // Must be checked before Beblia, which also uses <book>/<chapter>/<verse>.
    raw = parseUsx(doc);
    format = "usx";
  } else if (
    Array.from(doc.getElementsByTagName("verse")).some((v) =>
      v.getAttribute("osisID"),
    )
  ) {
    raw = parseOsis(doc);
    format = "osis";
  } else if (
    doc.getElementsByTagName("book").length > 0 &&
    doc.getElementsByTagName("chapter").length > 0 &&
    doc.getElementsByTagName("verse").length > 0
  ) {
    // Beblia (<book number><chapter number><verse number>).
    raw = parseBeblia(doc);
    format = "beblia";
  } else {
    throw new Error(
      "Unrecognized Bible XML. Supported: Zefania, OpenSong, USX, OSIS, Beblia.",
    );
  }

  if (totalVerses(raw) === 0) {
    throw new Error("No verses could be read from this file.");
  }

  return finalize(raw, extractName(doc, fallbackName), detectLanguage(doc), format);
};
