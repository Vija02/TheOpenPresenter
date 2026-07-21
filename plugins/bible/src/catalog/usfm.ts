// USFM 3-letter book codes in canonical (Protestant, 66-book) order.
// helloao's book ids use exactly these codes, so index+1 is the canonical
// book number we use everywhere else in the plugin (BibleBookMeta.n).

export const USFM_ORDER = [
  "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA",
  "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO",
  "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO",
  "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL", "MAT",
  "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP",
  "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE",
  "2PE", "1JN", "2JN", "3JN", "JUD", "REV",
] as const;

const NUMBER_BY_USFM: Record<string, number> = Object.fromEntries(
  USFM_ORDER.map((code, i) => [code, i + 1]),
);

/** USFM code (e.g. "GEN") -> canonical 1..66 book number, or undefined. */
export const usfmToNumber = (code: string): number | undefined =>
  NUMBER_BY_USFM[code.toUpperCase()];

/** Canonical 1..66 book number -> USFM code (e.g. "GEN"), or undefined. */
export const numberToUsfm = (n: number): string | undefined =>
  USFM_ORDER[n - 1];
