import { ServerPluginApi } from "@repo/base-plugin/server";

import { BibleBookMeta, PluginBaseData, PluginRendererData } from "../types";

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
};
