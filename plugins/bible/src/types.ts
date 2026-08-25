import { LAYOUT_VIDEO_STATES_KEY, VIDEO_VOLUME_KEY } from "@repo/base-types";
import { type LayoutDoc, type LayoutVideoStates } from "@repo/layout";

// ---------------------------------------------------------------------------
// Passages
// ---------------------------------------------------------------------------

/** A single verse within a passage. */
export type BibleVerse = {
  bookId: string;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
};

/** Result shape shared by every lookup path (helloao catalog, DB) */
export type LookupResult = {
  reference: string;
  translationId: string;
  translationName: string;
  translationAbbreviation?: string | null;
  verses: BibleVerse[];
};

/** A set of verses added to the scene, e.g. "John 3:16-18", grouped into slides */
export type BiblePassage = {
  id: string;
  /** Resolved reference, e.g. "John 3:16-18" */
  reference: string;
  /** Translation identifier, e.g. "web", "kjv" */
  translationId: string;
  /** Translation display name, e.g. "World English Bible" */
  translationName: string;
  /** Short caption label, e.g. "KJV" */
  translationAbbreviation?: string | null;
  verses: BibleVerse[];
  /**
   * Manual slide grouping: verse count of each slide, in order, summing to
   * verses.length. Undefined => one verse per slide.
   */
  slideGroups?: number[];
};

// ---------------------------------------------------------------------------
// Book index (native book metadata for search & drill-down)
// ---------------------------------------------------------------------------

/** Per-book metadata for one translation, in its own language */
export type BibleBookMeta = {
  // Canonical 1..66 book number (language-independent key)
  n: number;
  // Native display name, e.g. "1. Mose"
  name: string;
  // Native abbreviations for matching, e.g. ["Gen", "Ge"]
  abbr: string[];
  // Verse count per chapter; chapters.length = chapter count
  chapters: number[];
};

/** A translation's book index (ordered by canonical book number) */
export type BibleBookIndex = BibleBookMeta[];

// ---------------------------------------------------------------------------
// Plugin data (persisted base data + per-renderer state)
// ---------------------------------------------------------------------------

export type PluginBaseData = {
  passages: BiblePassage[];
  template?: LayoutDoc | null;
  showVerseNumbers?: boolean;
};

export type PluginRendererData = {
  passageId: string | null;
  slideIndex: number | null;
  lastClickTimestamp?: number | null;

  [LAYOUT_VIDEO_STATES_KEY]?: LayoutVideoStates;
  [VIDEO_VOLUME_KEY]?: number;
};
