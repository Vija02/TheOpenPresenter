import axios from "axios";

import { LookupResult } from "../types";
import { defaultTranslationId } from "./translations";

type BibleApiResponse = {
  reference: string;
  verses: {
    book_id: string;
    book_name: string;
    chapter: number;
    verse: number;
    text: string;
  }[];
  text: string;
  translation_id: string;
  translation_name: string;
  error?: string;
};

const cleanVerseText = (text: string) =>
  text
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const lookupPassage = async (
  reference: string,
  translationId: string = defaultTranslationId,
): Promise<LookupResult> => {
  const url =
    "https://bible-api.com/" +
    encodeURIComponent(reference.trim()) +
    `?translation=${encodeURIComponent(translationId)}`;

  const res = await axios.get<BibleApiResponse>(url, {
    validateStatus: (status) => status < 500,
  });

  if (res.status === 404 || res.data?.error || !res.data?.verses?.length) {
    throw new Error(res.data?.error || `Could not find passage "${reference}"`);
  }

  const resolvedId = res.data.translation_id ?? translationId;
  return {
    reference: res.data.reference,
    translationId: resolvedId,
    translationName: res.data.translation_name ?? translationId,
    translationAbbreviation: resolvedId.toUpperCase(),
    verses: res.data.verses.map((v) => ({
      bookId: v.book_id,
      bookName: v.book_name,
      chapter: v.chapter,
      verse: v.verse,
      text: cleanVerseText(v.text),
    })),
  };
};
