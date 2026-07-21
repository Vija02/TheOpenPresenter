// Language-code normalization. Uploads use 2-letter codes ("en", "id"); helloao
// uses ISO 639-3 ("eng", "ind"); the Beblia generator emits 2-letter keys. We
// fold everything to one key so the language filter groups them and cross-source
// dedupe works.
//
// The map covers every ISO 639-1 language's 639-3/639-2(B) code(s), plus common
// macrolanguage members that should collapse to the macro (cmn -> zh, swh -> sw,
// arb -> ar, npi -> ne, ...). Codes with NO 639-1 equivalent (the ~950
// minority languages helloao carries, plus grc Ancient Greek, quc K'iche',
// hbo Biblical Hebrew, Romani, Coptic, ...) intentionally pass through as-is:
// they are distinct languages and must not be merged into a lookalike.
const ISO3_TO_2: Record<string, string> = {
  // a
  aar: "aa", abk: "ab", ave: "ae", afr: "af", aka: "ak", amh: "am",
  arg: "an", ara: "ar", arb: "ar", asm: "as", ava: "av", aym: "ay",
  aze: "az", azb: "az", azj: "az",
  // b
  bak: "ba", bel: "be", bul: "bg", bih: "bh", bis: "bi", bam: "bm",
  ben: "bn", bod: "bo", tib: "bo", bre: "br", bos: "bs",
  // c
  cat: "ca", che: "ce", cha: "ch", cos: "co", cre: "cr", ces: "cs",
  cze: "cs", chu: "cu", chv: "cv", cym: "cy", wel: "cy",
  // d
  dan: "da", deu: "de", ger: "de", div: "dv", dzo: "dz",
  // e
  ewe: "ee", ell: "el", gre: "el", eng: "en", epo: "eo", spa: "es",
  est: "et", ekk: "et", eus: "eu", baq: "eu",
  // f
  fas: "fa", per: "fa", pes: "fa", prs: "fa", ful: "ff", fin: "fi",
  fij: "fj", fao: "fo", fra: "fr", fre: "fr", fry: "fy",
  // g
  gle: "ga", gla: "gd", glg: "gl", grn: "gn", guj: "gu", glv: "gv",
  // h
  hau: "ha", heb: "he", hin: "hi", hmo: "ho", hrv: "hr", hat: "ht",
  hun: "hu", hye: "hy", arm: "hy", her: "hz",
  // i
  ina: "ia", ind: "id", ile: "ie", ibo: "ig", iii: "ii", ipk: "ik",
  ido: "io", isl: "is", ice: "is", ita: "it", iku: "iu",
  // j
  jpn: "ja", jav: "jv",
  // k
  kat: "ka", geo: "ka", kon: "kg", kik: "ki", kua: "kj", kaz: "kk",
  kal: "kl", khm: "km", kan: "kn", kor: "ko", kau: "kr", kas: "ks",
  kur: "ku", ckb: "ku", kmr: "ku", kom: "kv", cor: "kw", kir: "ky",
  // l
  lat: "la", ltz: "lb", lug: "lg", lim: "li", lin: "ln", lao: "lo",
  lit: "lt", lub: "lu", lav: "lv", lvs: "lv",
  // m
  mlg: "mg", mah: "mh", mri: "mi", mao: "mi", mkd: "mk", mac: "mk",
  mal: "ml", mon: "mn", khk: "mn", mar: "mr", msa: "ms", may: "ms",
  zlm: "ms", zsm: "ms", mlt: "mt", mya: "my", bur: "my",
  // n
  nau: "na", nob: "nb", nde: "nd", nep: "ne", npi: "ne", ndo: "ng",
  nld: "nl", dut: "nl", nno: "nn", nor: "no", nbl: "nr", nav: "nv",
  nya: "ny",
  // o
  oci: "oc", oji: "oj", orm: "om", gaz: "om", gax: "om", ori: "or",
  ory: "or", oss: "os",
  // p
  pan: "pa", pnb: "pa", pli: "pi", pol: "pl", pus: "ps", pbu: "ps",
  pbt: "ps", por: "pt",
  // q — Quechua macrolanguage members only (NOT quc = K'iche', a Mayan lang)
  que: "qu", quh: "qu", qul: "qu", qub: "qu", qup: "qu", quf: "qu",
  quz: "qu", quy: "qu", qvc: "qu", qve: "qu", qvh: "qu", qvm: "qu",
  qvn: "qu", qvs: "qu", qvw: "qu", qvz: "qu", qwh: "qu", qxh: "qu",
  qxn: "qu", qxo: "qu",
  // r
  roh: "rm", run: "rn", ron: "ro", rum: "ro", rus: "ru", kin: "rw",
  // s
  san: "sa", srd: "sc", snd: "sd", sme: "se", sag: "sg", sin: "si",
  slk: "sk", slo: "sk", slv: "sl", smo: "sm", sna: "sn", som: "so",
  sqi: "sq", alb: "sq", srp: "sr", ssw: "ss", sot: "st", sun: "su",
  swe: "sv", swa: "sw", swh: "sw",
  // t
  tam: "ta", tel: "te", tgk: "tg", tha: "th", tir: "ti", tuk: "tk",
  tgl: "tl", tsn: "tn", ton: "to", tur: "tr", tso: "ts", tat: "tt",
  twi: "tw", tah: "ty",
  // u
  uig: "ug", ukr: "uk", urd: "ur", uzb: "uz", uzn: "uz", uzs: "uz",
  // v
  ven: "ve", vie: "vi", vol: "vo",
  // w
  wln: "wa", wol: "wo",
  // x
  xho: "xh",
  // y
  yid: "yi", ydd: "yi", yor: "yo",
  // z
  zha: "za", zho: "zh", chi: "zh", cmn: "zh", zul: "zu",
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", id: "Indonesian", pt: "Portuguese", es: "Spanish",
  fr: "French", de: "German", ko: "Korean", zh: "Chinese", la: "Latin",
  ro: "Romanian", ja: "Japanese", ru: "Russian", ar: "Arabic", hi: "Hindi",
  tl: "Tagalog", vi: "Vietnamese", th: "Thai", nl: "Dutch", el: "Greek",
  he: "Hebrew", it: "Italian", pl: "Polish", sw: "Swahili", ta: "Tamil",
  te: "Telugu", uk: "Ukrainian", cs: "Czech", hu: "Hungarian", fi: "Finnish",
  sv: "Swedish", no: "Norwegian", da: "Danish", ms: "Malay", my: "Burmese",
  af: "Afrikaans", sq: "Albanian", am: "Amharic", hy: "Armenian",
  bn: "Bengali", bg: "Bulgarian", hr: "Croatian", nb: "Norwegian",
  ur: "Urdu", fa: "Persian", pa: "Punjabi", sr: "Serbian", sk: "Slovak",
  sl: "Slovenian", so: "Somali", tr: "Turkish", uz: "Uzbek", yo: "Yoruba",
  zu: "Zulu", ug: "Uyghur",
  ml: "Malayalam", kn: "Kannada", mr: "Marathi", or: "Odia", gu: "Gujarati",
  ne: "Nepali", si: "Sinhala", km: "Khmer", lo: "Lao", ka: "Georgian",
  et: "Estonian", lv: "Latvian", lt: "Lithuanian", is: "Icelandic",
  ga: "Irish", cy: "Welsh", eu: "Basque", ca: "Catalan", gl: "Galician",
  eo: "Esperanto", ha: "Hausa", ig: "Igbo", sn: "Shona", ny: "Chichewa",
  rw: "Kinyarwanda", mg: "Malagasy", ht: "Haitian Creole", sa: "Sanskrit",
  ee: "Ewe", tw: "Twi", wo: "Wolof", tg: "Tajik", mn: "Mongolian",
  mk: "Macedonian", be: "Belarusian",
};

/** Fold any language code to its canonical key (2-letter where known). */
export const languageKey = (code: string): string => {
  const lower = code.trim().toLowerCase();
  return ISO3_TO_2[lower] ?? lower;
};

/**
 * Human label for a language key. Prefers a known English name, then any
 * fallback the source provided (e.g. helloao's languageEnglishName), then the
 * uppercased code.
 */
export const languageLabel = (code: string, fallback?: string | null): string => {
  const key = languageKey(code);
  return LANGUAGE_NAMES[key] ?? fallback ?? key.toUpperCase();
};
