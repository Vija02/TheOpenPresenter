import { TranslationSummary } from "../storage/types";
import { BEBLIA_TRANSLATIONS } from "./beblia.generated";
import { fetchHelloaoCatalog } from "./helloaoApi";
import { languageKey, languageLabel } from "./language";
import { popularityRank } from "./popularity";

// A single entry in the unified translation catalog surfaced by Settings.
export type CatalogSource = "helloao" | "beblia" | "upload";
export type CatalogAvailability = "public" | "uploaded" | "upload";

export type CatalogTranslation = {
  id: string;
  name: string;
  abbreviation: string | null;
  /** Original language code as the source reported it. */
  language: string;
  /** Normalized language key used for filtering (see language.ts). */
  languageKey: string;
  /** Human language label for display. */
  languageLabel: string;
  source: CatalogSource;
  /** public = we serve it live; uploaded = org has the text; upload = bring your own. */
  availability: CatalogAvailability;
  /**
   * DB id of the uploaded translation backing this row. Set when the org has
   * attached an upload to this catalog entry, or when the row IS an upload.
   * Resolution goes through bible.resolveCustom with this id.
   */
  uploadId?: string;
  numberOfBooks?: number;
  totalNumberOfVerses?: number;
  /** Lower = more popular. */
  popularity: number;
};

/**
 * Build the unified catalog: helloao ("public"), the Beblia listing
 * ("upload"), and the org's own uploads. An upload carrying a
 * catalogId is folded INTO that catalog row (which flips to "uploaded");
 * uploads without one become standalone rows.
 */
export const buildCatalog = async (
  uploads: TranslationSummary[],
): Promise<CatalogTranslation[]> => {
  const out: CatalogTranslation[] = [];

  // Track what helloao already offers, so the (huge) Beblia listing
  // can drop anything we already have. Matching is best-effort across sources
  // that share no key: by language + normalized abbreviation, and by whether a
  // known name appears inside the Beblia name.
  const norm = (s: string | null | undefined) =>
    (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const takenAbbr = new Set<string>(); // `${languageKey}:${normAbbr}`
  const namesByLang = new Map<string, string[]>(); // languageKey -> [normName]
  const remember = (key: string, abbr: string | null, name: string) => {
    if (abbr) takenAbbr.add(`${key}:${norm(abbr)}`);
    const list = namesByLang.get(key) ?? [];
    list.push(norm(name));
    namesByLang.set(key, list);
  };

  // Split uploads: attached to a catalog entry vs standalone.
  const attached = new Map<string, TranslationSummary>();
  const standalone: TranslationSummary[] = [];
  for (const u of uploads) {
    if (u.catalogId) attached.set(u.catalogId, u);
    else standalone.push(u);
  }

  // Fold an attached upload into its catalog row, if any.
  const consumed = new Set<string>();
  const withAttachment = (entry: CatalogTranslation): CatalogTranslation => {
    const up = attached.get(entry.id);
    if (!up) return entry;
    consumed.add(entry.id);
    return {
      ...entry,
      availability: "uploaded",
      uploadId: up.id,
      numberOfBooks: up.bookCount,
    };
  };

  // 1) helloao free catalog (served live via helloao)
  let helloao: Awaited<ReturnType<typeof fetchHelloaoCatalog>> = [];
  try {
    helloao = await fetchHelloaoCatalog();
  } catch {
    helloao = []; // Degrade gracefully if helloao is unreachable.
  }
  for (const t of helloao) {
    if ((t.numberOfApocryphalBooks ?? 0) > 0) continue;
    const key = languageKey(t.language);
    const abbr = t.shortName ?? null;
    remember(key, abbr, t.name);
    out.push(
      withAttachment({
        id: t.id,
        name: t.name,
        abbreviation: abbr,
        language: t.language,
        languageKey: key,
        languageLabel: languageLabel(t.language, t.languageEnglishName),
        source: "helloao",
        availability: "public",
        numberOfBooks: t.numberOfBooks,
        totalNumberOfVerses: t.totalNumberOfVerses,
        popularity: popularityRank(key, abbr, t.numberOfBooks),
      }),
    );
  }

  // 2) Beblia listing (metadata only). Drop anything helloao already covers.
  for (const t of BEBLIA_TRANSLATIONS) {
    if (
      t.abbreviation &&
      takenAbbr.has(`${t.languageKey}:${norm(t.abbreviation)}`)
    ) {
      continue;
    }
    // Name-level dedupe for entries whose abbreviation didn't match (e.g. the
    // default per-language file that carries no code): skip if a known name
    // contains, or is contained by, this one.
    const bname = norm(t.name);
    const known = namesByLang.get(t.languageKey);
    if (
      bname &&
      known?.some(
        (n) => n.length > 3 && (bname.includes(n) || n.includes(bname)),
      )
    ) {
      continue;
    }
    out.push(
      withAttachment({
        id: t.id,
        name: t.name,
        abbreviation: t.abbreviation,
        language: t.languageKey,
        languageKey: t.languageKey,
        languageLabel: t.languageLabel,
        source: "beblia",
        availability: "upload",
        numberOfBooks: 66,
        popularity: popularityRank(
          t.languageKey,
          t.abbreviation,
          66,
          t.isDefault,
        ),
      }),
    );
  }

  // 4) Standalone uploads
  const orphaned = [...attached.entries()]
    .filter(([catalogId]) => !consumed.has(catalogId))
    .map(([, upload]) => upload);

  for (const u of [...standalone, ...orphaned]) {
    const key = languageKey(u.language);
    out.push({
      id: u.id,
      name: u.name,
      abbreviation: u.abbreviation,
      language: u.language,
      languageKey: key,
      languageLabel: languageLabel(u.language),
      source: "upload",
      availability: "uploaded",
      uploadId: u.id,
      numberOfBooks: u.bookCount,
      popularity: popularityRank(key, u.abbreviation, u.bookCount),
    });
  }

  return out;
};

/** Metadata for specific ids (used by the search bar for selected translations). */
export const catalogByIds = async (
  ids: string[],
  uploads: TranslationSummary[],
): Promise<CatalogTranslation[]> => {
  const wanted = new Set(ids);
  const all = await buildCatalog(uploads);
  return all.filter((t) => wanted.has(t.id));
};

// ---------------------------------------------------------------------------
// Server-side query
// ---------------------------------------------------------------------------

export type CatalogQuery = {
  query?: string;
  languageKeys?: string[];
  onlyUsable?: boolean;
  excludeIds?: string[];
  offset?: number;
  limit?: number;
};

export type CatalogPage = {
  items: CatalogTranslation[];
  total: number;
  nextOffset: number | null;
};

const PAGE_MAX = 100;
const PAGE_DEFAULT = 50;

const matchesQuery = (t: CatalogTranslation, opts: CatalogQuery): boolean => {
  if (opts.languageKeys?.length && !opts.languageKeys.includes(t.languageKey)) {
    return false;
  }
  if (opts.onlyUsable && t.availability === "upload") return false;
  const q = opts.query?.trim().toLowerCase();
  if (q) {
    const hay = `${t.name} ${t.abbreviation ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
};

export const queryCatalog = async (
  uploads: TranslationSummary[],
  opts: CatalogQuery,
): Promise<CatalogPage> => {
  const all = await buildCatalog(uploads);
  const exclude = new Set(opts.excludeIds ?? []);

  const filtered = all
    .filter((t) => !exclude.has(t.id) && matchesQuery(t, opts))
    .sort(
      (a, b) => a.popularity - b.popularity || a.name.localeCompare(b.name),
    );

  const offset = Math.max(0, Math.trunc(opts.offset ?? 0));
  const limit = Math.min(
    PAGE_MAX,
    Math.max(1, Math.trunc(opts.limit ?? PAGE_DEFAULT)),
  );
  const items = filtered.slice(offset, offset + limit);
  const end = offset + items.length;
  return {
    items,
    total: filtered.length,
    nextOffset: end < filtered.length ? end : null,
  };
};

/** Distinct languages in the catalog, labelled and sorted */
export const catalogLanguages = async (
  uploads: TranslationSummary[],
): Promise<{ value: string; label: string }[]> => {
  const all = await buildCatalog(uploads);
  const byKey = new Map<string, string>();
  for (const t of all) {
    if (!byKey.has(t.languageKey)) byKey.set(t.languageKey, t.languageLabel);
  }
  return Array.from(byKey.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
};
