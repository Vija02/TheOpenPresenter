import { ServerPluginApi } from "@repo/base-plugin/server";
import type { LayoutDoc } from "@repo/layout";

import {
  BibleBookMeta,
  BiblePreferences,
  PluginBaseData,
  PluginRendererData,
} from "../types";

export type { BiblePreferences };

export type Api = ServerPluginApi<PluginBaseData, PluginRendererData>;

export type RequestAuth = {
  sessionId: string | null;
  screenGuestSessionId: string | null;
};

export type ChapterInput = {
  book: string;
  bookNumber: number;
  chapter: number;
  verses: { v: number; t: string }[];
};

export type TranslationSummary = {
  id: string;
  name: string;
  abbreviation: string | null;
  language: string;
  bookCount: number;
  books: BibleBookMeta[];
  updatedAt: string;
  // null = standalone upload, listed as its own row
  catalogId: string | null;
};

export type SavedTemplate = {
  template: LayoutDoc;
  showVerseNumbers: boolean;
};
