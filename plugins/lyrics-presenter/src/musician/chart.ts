import { isChordToken } from "../chords/chord";
import { type ChordSegment, chordSegments } from "../chords/chordpro";
import {
  isOpenSongChordLine,
  openSongToChordPro,
} from "../chords/convert/openSongToChordPro";
import { resolveKey, transposeContent, transposeKey } from "../chords/song";
import { processSong } from "../songHelpers";
import type { Song } from "../types";

/** Numbered as the outputs number slides, so `index` matches `currentIndex` */
export type ChartSlide = {
  index: number;
  lines: ChordSegment[][];
};

export type ChartSection = {
  heading: string;
  slides: ChartSlide[];
};

export type SongChart = {
  sections: ChartSection[];
  hasChords: boolean;
  /** After transposing. Null when unknown */
  key: string | null;
  originalKey: string | null;
};

/** Into -5..+6, the shortest way round to the same key */
export const normalizeSemitones = (semitones: number): number =>
  ((((semitones + 5) % 12) + 12) % 12) - 5;

export const inlineChords = (content: string): string =>
  openSongToChordPro(content)
    .split("\n")
    .flatMap((line) => {
      if (!isOpenSongChordLine(line)) return [line];
      const chords = line.slice(1).split(/\s+/).filter(isChordToken);
      return chords.length > 0
        ? [chords.map((chord) => `[${chord}]`).join(" ")]
        : [];
    })
    .join("\n");

export const songChart = (
  song: Pick<Song, "content" | "setting" | "key">,
  transpose = 0,
): SongChart => {
  const semitones = normalizeSemitones(transpose);
  const originalKey = resolveKey(song);
  // Transposing reads both formats, so it goes first
  const content = inlineChords(
    transposeContent(song.content, semitones, originalKey),
  );
  const groups = processSong(content, song.setting.sectionOrder, {
    chords: true,
  });

  let index = 0;
  let hasChords = false;
  const sections = groups.map((group) => ({
    heading: group.heading,
    slides: group.slides.map((lines) => {
      const slide: ChartSlide = {
        index: index++,
        lines: lines.map((line) => {
          const segments = chordSegments(line);
          if (segments.some((s) => s.chord !== null)) hasChords = true;
          return segments;
        }),
      };
      return slide;
    }),
  }));

  return {
    sections,
    hasChords,
    key: semitones === 0 ? originalKey : transposeKey(originalKey, semitones),
    originalKey,
  };
};

export const sectionOfSlide = (
  chart: SongChart,
  index: number | null,
): number | null => {
  if (index === null) return null;
  const found = chart.sections.findIndex((section) =>
    section.slides.some((slide) => slide.index === index),
  );
  return found === -1 ? null : found;
};

export type KeyOption = {
  semitones: number;
  key: string;
};

/** All 12 keys, -5 to +6 semitones from the original */
export const keyOptions = (originalKey: string | null): KeyOption[] => {
  if (!originalKey) return [];
  const options: KeyOption[] = [];
  for (let semitones = -5; semitones <= 6; semitones++) {
    const key =
      semitones === 0 ? originalKey : transposeKey(originalKey, semitones);
    if (key) options.push({ semitones, key });
  }
  return options;
};
