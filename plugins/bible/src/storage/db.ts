import { DEFAULT_TRANSLATION_ID, pluginName } from "../consts";
import { deriveAbbreviation } from "../helpers/abbreviation";
import { BibleBookMeta, LookupResult } from "../types";
import {
  Api,
  BiblePreferences,
  ChapterInput,
  RequestAuth,
  TranslationSummary,
} from "./types";

export const listTranslations = async (
  api: Api,
  auth: RequestAuth,
  organizationId: string,
): Promise<TranslationSummary[]> => {
  const db = api.getPluginDb(pluginName, auth);
  const { rows } = await db.query(
    `select id,
            name,
            abbreviation,
            language,
            book_count as "bookCount",
            books,
            updated_at as "updatedAt",
            catalog_id as "catalogId"
       from translation
      where organization_id = $1 or organization_id is null
      order by lower(name) asc`,
    [organizationId],
  );
  return rows as TranslationSummary[];
};

export const createTranslation = async (
  api: Api,
  auth: RequestAuth,
  {
    organizationId,
    userId,
    name,
    abbreviation,
    language,
    format,
    books,
    chapters,
    catalogId,
  }: {
    organizationId: string;
    userId: string | null;
    name: string;
    abbreviation: string | null;
    language: string;
    format: string;
    books: BibleBookMeta[];
    chapters: ChapterInput[];
    catalogId?: string | null;
  },
): Promise<string> => {
  const db = api.getPluginDb(pluginName, auth);

  // Re-uploading for the same catalog entry replaces the previous copy
  // (chapters cascade via FK), keeping the unique index satisfied.
  if (catalogId) {
    await db.query(
      `delete from translation
        where organization_id = $1 and catalog_id = $2`,
      [organizationId, catalogId],
    );
  }

  const {
    rows: [row],
  } = await db.query<{ id: string }>(
    `with new_t as (
       insert into translation
         (organization_id, created_by_user_id, name, abbreviation,
          language, format, book_count, books, catalog_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $10)
       returning id
     ), ins_ch as (
       insert into translation_chapter
         (translation_id, organization_id, book, book_number, chapter, verses)
       select nt.id, $1, c.book, c.book_number, c.chapter, c.verses
         from new_t nt,
              jsonb_to_recordset($9::jsonb)
                as c(book text, book_number int, chapter int, verses jsonb)
       returning 1
     )
     select id from new_t`,
    [
      organizationId,
      userId,
      name,
      abbreviation,
      language,
      format,
      books.length,
      JSON.stringify(books),
      JSON.stringify(
        chapters.map((c) => ({
          book: c.book,
          book_number: c.bookNumber,
          chapter: c.chapter,
          verses: c.verses,
        })),
      ),
      catalogId ?? null,
    ],
  );
  return row!.id;
};

export const deleteTranslation = async (
  api: Api,
  auth: RequestAuth,
  organizationId: string,
  id: string,
): Promise<void> => {
  const db = api.getPluginDb(pluginName, auth);
  // chapters cascade via FK
  await db.query(
    `delete from translation where id = $1 and organization_id = $2`,
    [id, organizationId],
  );
};

/** Resolves the passage */
export const resolveFromDb = async (
  api: Api,
  auth: RequestAuth,
  {
    organizationId,
    translationId,
    bookName,
    bookNumber,
    chapter,
    verseStart,
    verseEnd,
  }: {
    organizationId: string;
    translationId: string;
    bookName: string;
    bookNumber: number;
    chapter: number;
    verseStart?: number;
    verseEnd?: number;
  },
): Promise<LookupResult> => {
  const db = api.getPluginDb(pluginName, auth);

  const {
    rows: [meta],
  } = await db.query<{ name: string; abbreviation: string | null }>(
    `select name, abbreviation from translation
      where id = $1 and (organization_id = $2 or organization_id is null)
      limit 1`,
    [translationId, organizationId],
  );
  if (!meta) throw new Error("Translation not found");

  const {
    rows: [row],
  } = await db.query<{ verses: { v: number; t: string }[] }>(
    `select verses from translation_chapter
      where translation_id = $1 and book_number = $2 and chapter = $3
        and (organization_id = $4 or organization_id is null)
      limit 1`,
    [translationId, bookNumber, chapter, organizationId],
  );
  if (!row) {
    throw new Error(`${bookName} ${chapter} is not in this translation`);
  }

  const all = (row.verses ?? []).sort((a, b) => a.v - b.v);
  let selected = all;
  if (verseStart != null) {
    const end = verseEnd ?? verseStart;
    selected = all.filter((x) => x.v >= verseStart && x.v <= end);
  }
  if (selected.length === 0) {
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
    translationName: meta.name,
    translationAbbreviation: meta.abbreviation ?? deriveAbbreviation(meta.name),
    verses: selected.map((x) => ({
      bookId: String(bookNumber),
      bookName,
      chapter,
      verse: x.v,
      text: x.t,
    })),
  };
};

/** Languages the catalog is filtered to on first run. */
export const DEFAULT_LANGUAGES = ["en"] as const;

export const getPreferences = async (
  api: Api,
  auth: RequestAuth,
  organizationId: string,
): Promise<BiblePreferences> => {
  const db = api.getPluginDb(pluginName, auth);
  const { rows } = await db.query(
    `select languages,
            translation_ids as "translationIds",
            primary_translation_id as "primaryTranslationId",
            favorite_translation_ids as "favoriteIds"
       from bible_preference
      where organization_id = $1
      limit 1`,
    [organizationId],
  );
  const row = rows[0];

  if (!row) {
    return {
      languages: [...DEFAULT_LANGUAGES],
      translationIds: [DEFAULT_TRANSLATION_ID],
      primaryTranslationId: DEFAULT_TRANSLATION_ID,
      favoriteIds: [DEFAULT_TRANSLATION_ID],
    };
  }

  return {
    languages: (row.languages as string[]) ?? [],
    translationIds: (row.translationIds as string[]) ?? [],
    primaryTranslationId: (row.primaryTranslationId as string | null) ?? null,
    favoriteIds: (row.favoriteIds as string[]) ?? [],
  };
};

export const setPreferences = async (
  api: Api,
  auth: RequestAuth,
  args: {
    organizationId: string;
    languages: string[];
    translationIds: string[];
    primaryTranslationId: string | null;
    favoriteIds: string[];
  },
): Promise<void> => {
  const db = api.getPluginDb(pluginName, auth);
  await db.query(
    `insert into bible_preference
        (organization_id, languages, translation_ids, primary_translation_id,
         favorite_translation_ids)
      values ($1, $2::jsonb, $3::jsonb, $4, $5::jsonb)
      on conflict (organization_id) do update set
        languages = excluded.languages,
        translation_ids = excluded.translation_ids,
        primary_translation_id = excluded.primary_translation_id,
        favorite_translation_ids = excluded.favorite_translation_ids`,
    [
      args.organizationId,
      JSON.stringify(args.languages),
      JSON.stringify(args.translationIds),
      args.primaryTranslationId,
      JSON.stringify(args.favoriteIds),
    ],
  );
};
