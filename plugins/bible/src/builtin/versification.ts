import { bcv_parser } from "bible-passage-reference-parser/esm/bcv_parser.js";
import * as en from "bible-passage-reference-parser/esm/lang/en.js";

import { BibleBookIndex } from "../types";

/**
 * The canonical 66-book table for the standard (Protestant) versification,
 * used as the default book index for the built-in translations and as the
 * fallback grid when a translation ships no metadata of its own.
 */
const CANON: { osis: string; name: string; abbr: string[] }[] = [
  { osis: "Gen", name: "Genesis", abbr: ["Gen", "Ge", "Gn"] },
  { osis: "Exod", name: "Exodus", abbr: ["Exod", "Ex", "Exo"] },
  { osis: "Lev", name: "Leviticus", abbr: ["Lev", "Le", "Lv"] },
  { osis: "Num", name: "Numbers", abbr: ["Num", "Nu", "Nm"] },
  { osis: "Deut", name: "Deuteronomy", abbr: ["Deut", "Dt", "De"] },
  { osis: "Josh", name: "Joshua", abbr: ["Josh", "Jos", "Jsh"] },
  { osis: "Judg", name: "Judges", abbr: ["Judg", "Jdg", "Jg"] },
  { osis: "Ruth", name: "Ruth", abbr: ["Ruth", "Ru", "Rth"] },
  { osis: "1Sam", name: "1 Samuel", abbr: ["1 Sam", "1Sa", "1Sm"] },
  { osis: "2Sam", name: "2 Samuel", abbr: ["2 Sam", "2Sa", "2Sm"] },
  { osis: "1Kgs", name: "1 Kings", abbr: ["1 Kgs", "1Ki", "1Kg"] },
  { osis: "2Kgs", name: "2 Kings", abbr: ["2 Kgs", "2Ki", "2Kg"] },
  { osis: "1Chr", name: "1 Chronicles", abbr: ["1 Chr", "1Ch"] },
  { osis: "2Chr", name: "2 Chronicles", abbr: ["2 Chr", "2Ch"] },
  { osis: "Ezra", name: "Ezra", abbr: ["Ezra", "Ezr"] },
  { osis: "Neh", name: "Nehemiah", abbr: ["Neh", "Ne"] },
  { osis: "Esth", name: "Esther", abbr: ["Esth", "Est", "Es"] },
  { osis: "Job", name: "Job", abbr: ["Job", "Jb"] },
  { osis: "Ps", name: "Psalms", abbr: ["Ps", "Psa", "Psalm", "Pss"] },
  { osis: "Prov", name: "Proverbs", abbr: ["Prov", "Pr", "Prv"] },
  { osis: "Eccl", name: "Ecclesiastes", abbr: ["Eccl", "Ecc", "Ec"] },
  { osis: "Song", name: "Song of Solomon", abbr: ["Song", "SoS", "Canticles"] },
  { osis: "Isa", name: "Isaiah", abbr: ["Isa", "Is"] },
  { osis: "Jer", name: "Jeremiah", abbr: ["Jer", "Je", "Jr"] },
  { osis: "Lam", name: "Lamentations", abbr: ["Lam", "La"] },
  { osis: "Ezek", name: "Ezekiel", abbr: ["Ezek", "Eze", "Ezk"] },
  { osis: "Dan", name: "Daniel", abbr: ["Dan", "Da", "Dn"] },
  { osis: "Hos", name: "Hosea", abbr: ["Hos", "Ho"] },
  { osis: "Joel", name: "Joel", abbr: ["Joel", "Joe", "Jl"] },
  { osis: "Amos", name: "Amos", abbr: ["Amos", "Am"] },
  { osis: "Obad", name: "Obadiah", abbr: ["Obad", "Ob"] },
  { osis: "Jonah", name: "Jonah", abbr: ["Jonah", "Jon", "Jnh"] },
  { osis: "Mic", name: "Micah", abbr: ["Mic", "Mi"] },
  { osis: "Nah", name: "Nahum", abbr: ["Nah", "Na"] },
  { osis: "Hab", name: "Habakkuk", abbr: ["Hab", "Hb"] },
  { osis: "Zeph", name: "Zephaniah", abbr: ["Zeph", "Zep", "Zp"] },
  { osis: "Hag", name: "Haggai", abbr: ["Hag", "Hg"] },
  { osis: "Zech", name: "Zechariah", abbr: ["Zech", "Zec", "Zc"] },
  { osis: "Mal", name: "Malachi", abbr: ["Mal", "Ml"] },
  { osis: "Matt", name: "Matthew", abbr: ["Matt", "Mt"] },
  { osis: "Mark", name: "Mark", abbr: ["Mark", "Mk", "Mr"] },
  { osis: "Luke", name: "Luke", abbr: ["Luke", "Lk", "Lu"] },
  { osis: "John", name: "John", abbr: ["John", "Jn", "Jhn"] },
  { osis: "Acts", name: "Acts", abbr: ["Acts", "Ac", "Act"] },
  { osis: "Rom", name: "Romans", abbr: ["Rom", "Ro", "Rm"] },
  { osis: "1Cor", name: "1 Corinthians", abbr: ["1 Cor", "1Co"] },
  { osis: "2Cor", name: "2 Corinthians", abbr: ["2 Cor", "2Co"] },
  { osis: "Gal", name: "Galatians", abbr: ["Gal", "Ga"] },
  { osis: "Eph", name: "Ephesians", abbr: ["Eph", "Ep"] },
  { osis: "Phil", name: "Philippians", abbr: ["Phil", "Php", "Pp"] },
  { osis: "Col", name: "Colossians", abbr: ["Col", "Co"] },
  { osis: "1Thess", name: "1 Thessalonians", abbr: ["1 Thess", "1Th"] },
  { osis: "2Thess", name: "2 Thessalonians", abbr: ["2 Thess", "2Th"] },
  { osis: "1Tim", name: "1 Timothy", abbr: ["1 Tim", "1Ti"] },
  { osis: "2Tim", name: "2 Timothy", abbr: ["2 Tim", "2Ti"] },
  { osis: "Titus", name: "Titus", abbr: ["Titus", "Tit", "Ti"] },
  { osis: "Phlm", name: "Philemon", abbr: ["Phlm", "Phm", "Pm"] },
  { osis: "Heb", name: "Hebrews", abbr: ["Heb", "He"] },
  { osis: "Jas", name: "James", abbr: ["Jas", "Jm", "Jas"] },
  { osis: "1Pet", name: "1 Peter", abbr: ["1 Pet", "1Pe", "1Pt"] },
  { osis: "2Pet", name: "2 Peter", abbr: ["2 Pet", "2Pe", "2Pt"] },
  { osis: "1John", name: "1 John", abbr: ["1 John", "1Jn", "1Jo"] },
  { osis: "2John", name: "2 John", abbr: ["2 John", "2Jn", "2Jo"] },
  { osis: "3John", name: "3 John", abbr: ["3 John", "3Jn", "3Jo"] },
  { osis: "Jude", name: "Jude", abbr: ["Jude", "Jud", "Jd"] },
  { osis: "Rev", name: "Revelation", abbr: ["Rev", "Re", "Rv"] },
];

let cached: BibleBookIndex | null = null;

/**
 * The standard English book index (names + abbreviations + per-chapter verse
 * counts). Memoised: the bcv parser is constructed once and its versification
 * table read a single time.
 */
export const getStandardBooks = (): BibleBookIndex => {
  if (cached) return cached;

  let chaptersByOsis: Record<string, number[]> = {};
  try {
    const bcv = new bcv_parser(en);
    const info = bcv.translation_info("default");
    // bcv exposes `chapters`: { "Gen": [31, 25, ...], ... } — the last-verse
    // number of every chapter, i.e. its verse count.
    chaptersByOsis = (info?.chapters as Record<string, number[]>) ?? {};
  } catch {
    // If the parser shape ever changes, degrade gracefully: names still work,
    // chapter/verse grids just won't show until fixed.
    chaptersByOsis = {};
  }

  cached = CANON.map((b, i) => ({
    n: i + 1,
    name: b.name,
    abbr: b.abbr,
    chapters: chaptersByOsis[b.osis] ?? [],
  }));
  return cached;
};

/** Canonical English name for a 1..66 book number, or undefined. */
export const canonicalBookName = (n: number): string | undefined =>
  CANON[n - 1]?.name;
