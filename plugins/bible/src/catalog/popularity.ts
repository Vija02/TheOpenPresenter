// Hand-ranked popularity order per language
const POPULAR_BY_LANG: Record<string, string[]> = {
  id: ["TB", "TB2", "AYT", "BIS", "TSI", "TL", "FAYH", "VMD", "AGS"],
  en: [
    "NIV",
    "KJV",
    "KJ",
    "ESV",
    "NLT",
    "NKJV",
    "NKJ",
    "NASB",
    "CSB",
    "MSG",
    "AMP",
    "NRSV",
    "RSV",
    "WEB",
    "ASV",
    "BBE",
    "YLT",
    "WEBBE",
    "OEB",
    "DRA",
  ],
  pt: ["ARC", "ARA", "NVI", "ACF", "NTLH", "ALMEIDA", "BLT"],
  es: ["RVR", "NVI", "RVA", "LBLA", "DHH"],
  fr: ["LSG", "BDS", "NEG", "S21"],
  de: ["LUT", "ELB", "HFA", "SCH"],
  ko: ["KRV", "NKRV"],
  // 和合本 (Chinese Union Version) is dominant; then Revised Union, Contemporary, CNV.
  zh: [
    "CUV",
    "CU1",
    "RCUVT",
    "RCUVSS",
    "CCBT",
    "CCBS",
    "CBS",
    "CBT",
    "CNVS",
    "CNVT",
  ],
  ru: ["SYN", "RST", "NRT", "CARS", "CARSA"],
  cs: ["BKR", "CEP", "NKB", "SNC"],
  pl: ["UBG", "BG", "NBG", "NPD"],
};

const LARGE = 9_000;

// Popularity rank within a language. Lower is better
export const popularityRank = (
  languageKey: string,
  abbreviation: string | null | undefined,
  numberOfBooks: number | undefined,
  isDefault = false,
): number => {
  const list = POPULAR_BY_LANG[languageKey];
  const abbr = (abbreviation ?? "").toUpperCase();
  if (list && abbr) {
    const idx = list.indexOf(abbr);
    if (idx >= 0) return idx;
  }
  if (isDefault) return list ? 0.5 : -1;
  // Unranked: fuller Bibles float up (66 books -> ~0 penalty, fewer -> more).
  return LARGE + Math.max(0, 66 - (numberOfBooks ?? 0));
};
