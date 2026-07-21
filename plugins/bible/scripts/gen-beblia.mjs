// One-time, offline generator for the Beblia translation *listing*
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "Beblia/Holy-Bible-XML-Format";
const BRANCH = "master";
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
const CONCURRENCY = 24;

// English language name
const LANG_KEY = {
  Afrikaans: "af", Albanian: "sq", Amharic: "am", Arabic: "ar",
  Armenian: "hy", Azerbaijani: "az", Basque: "eu", Belarusian: "be",
  Bengali: "bn", Bulgarian: "bg", Burmese: "my", Catalan: "ca",
  Chinese: "zh", Croatian: "hr", Czech: "cs", Danish: "da", Dutch: "nl",
  English: "en", Esperanto: "eo", Estonian: "et", Finnish: "fi",
  French: "fr", Georgian: "ka", German: "de", Greek: "el", Gujarati: "gu",
  Haitian: "ht", Hausa: "ha", Hebrew: "he", Hindi: "hi", Hungarian: "hu",
  Icelandic: "is", Igbo: "ig", Indonesian: "id", Italian: "it",
  Japanese: "ja", Kannada: "kn", Kazakh: "kk", Khmer: "km", Korean: "ko",
  Kurdish: "ku", Lao: "lo", Latin: "la", Latvian: "lv", Lithuanian: "lt",
  Macedonian: "mk", Malagasy: "mg", Malay: "ms", Malayalam: "ml",
  Maltese: "mt", Maori: "mi", Marathi: "mr", Mongolian: "mn", Nepali: "ne",
  Norwegian: "no", Oromo: "om", Panjabi: "pa", Punjabi: "pa", Pashto: "ps",
  Persian: "fa", Polish: "pl", Portuguese: "pt", Romani: "rom",
  Romanian: "ro", Russian: "ru", Serbian: "sr", Shona: "sn", Sinhala: "si",
  Slovak: "sk", Slovenian: "sl", Somali: "so", Spanish: "es", Swahili: "sw",
  Swedish: "sv", Tagalog: "tl", Tajik: "tg", Tamil: "ta", Telugu: "te",
  Thai: "th", Tigrinya: "ti", Turkish: "tr", Ukrainian: "uk", Urdu: "ur",
  Uzbek: "uz", Vietnamese: "vi", Welsh: "cy", Xhosa: "xh", Yoruba: "yo",
  Zulu: "zu",
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const parseName = (base) => {
  const tokens = base
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]{2,})([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean);

  let lang, rest;
  if (tokens.length && LANG_KEY[tokens[0]]) {
    lang = tokens[0];
    rest = tokens.slice(1);
  } else {
    const langWords = [];
    let i = 0;
    for (; i < tokens.length; i++) {
      if (/^[A-Z][a-z]+$/.test(tokens[i])) langWords.push(tokens[i]);
      else break;
    }
    lang = langWords.join(" ") || tokens[0] || base;
    rest = tokens.slice(i);
  }

  return { lang, abbr: rest.join(" "), isDefault: rest.length === 0 };
};

const parseHeader = (text) => {
  const attr = (name) => {
    const m = text.match(new RegExp(`${name}="([^"]*)"`));
    return m ? m[1] : null;
  };
  return {
    translation: attr("translation"),
    status: attr("status"),
    link: attr("link"),
  };
};

const fetchTree = async () => {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`,
  );
  if (!res.ok) throw new Error(`tree fetch failed: ${res.status}`);
  const data = await res.json();
  return data.tree
    .filter((t) => t.type === "blob" && t.path.endsWith(".xml"))
    .map((t) => t.path);
};

const fetchHeader = async (file) => {
  try {
    const res = await fetch(`${RAW}/${encodeURIComponent(file)}`, {
      headers: { Range: "bytes=0-600" },
    });
    if (!res.ok && res.status !== 206) return null;
    const text = await res.text();
    return parseHeader(text);
  } catch {
    return null;
  }
};

// Small concurrency pool so 1000+ requests don't hammer the CDN.
const mapPool = async (items, limit, fn) => {
  const out = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
};

const main = async () => {
  console.error("Fetching file tree…");
  const files = await fetchTree();
  console.error(`  ${files.length} XML files`);

  console.error("Fetching headers…");
  let done = 0;
  const entries = await mapPool(files, CONCURRENCY, async (file) => {
    const base = file.replace(/\.xml$/, "").replace(/Bible$/, "");
    const { lang, abbr, isDefault } = parseName(base);
    const header = await fetchHeader(file);
    if (++done % 100 === 0) console.error(`  ${done}/${files.length}`);
    const key = LANG_KEY[lang.split(" ")[0]] ?? slug(lang);
    return {
      id: `beblia_${file.replace(/\.xml$/, "")}`,
      name: header?.translation?.trim() || `${lang}${abbr ? " " + abbr : ""}`,
      abbreviation: abbr || null,
      languageKey: key,
      languageLabel: lang,
      // The bare `<Language>Bible.xml`. Beblia's canonical pick, ranked first.
      isDefault,
      // Best-effort: a status that isn't just a bare society name and mentions
      // ©/copyright/rights is treated as copyrighted. Only affects a label.
      copyrighted: /©|copyright|rights reserved/i.test(header?.status ?? ""),
    };
  });

  entries.sort((a, b) =>
    a.languageLabel.localeCompare(b.languageLabel) ||
    a.name.localeCompare(b.name),
  );

  const header = `// AUTO-GENERATED by scripts/gen-beblia.mjs. Do not edit by hand.
// Metadata-only listing of Beblia translations (${entries.length} entries).
// Regenerate with:
//   node scripts/gen-beblia.mjs

export type BebliaTranslation = {
  id: string;
  name: string;
  abbreviation: string | null;
  languageKey: string;
  languageLabel: string;
  isDefault: boolean;
  copyrighted: boolean;
};

export const BEBLIA_TRANSLATIONS: BebliaTranslation[] = ${JSON.stringify(
    entries,
    null,
    2,
  )};
`;

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const out = path.join(__dirname, "..", "src", "catalog", "beblia.generated.ts");
  await writeFile(out, header);
  console.error(`\nWrote ${entries.length} entries -> ${out}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
