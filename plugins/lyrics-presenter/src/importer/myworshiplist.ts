import { detectAlignment } from "../chords/alignment/detectAlignment";
import { realignChordLineToMono } from "../chords/alignment/realignToMono";
import {
  collectChordLyricPairs,
  isOpenSongChordLine,
  openSongToChordPro,
} from "../chords/convert/openSongToChordPro";
import { decodeMwlChords } from "./mwlChords";
import { cleanWhiteSpace, finalize, headingOf, splitLines } from "./shared";

export type ConvertMWLOptions = {
  key?: string | null;
  format?: "chordpro" | "opensong";
};

export type ConvertMWLResult = {
  content: string;
  alignment: "mono" | "proportional";
};

/** Convert a MyWorshipList `content` field into our song format */
export const convertMWLDataDetailed = (
  content: string,
  options: ConvertMWLOptions = {},
): ConvertMWLResult => {
  const marked = removeAuxiliaryText(markChords(splitLines(content)));

  if (options.format === "opensong") {
    return {
      content: finalize(cleanWhiteSpace(marked).map(applyHeading)),
      alignment: "mono",
    };
  }

  // Decode BEFORE measuring: the author aligned against the rendered chord
  // names, so "D/A" is the text whose width mattered, not the seven characters
  // of "x05/x00"
  const key = options.key ?? null;
  const decoded = marked.map((line) =>
    isOpenSongChordLine(line)
      ? "." + decodeMwlChords(line.slice(1), key)
      : line,
  );

  const alignment = detectAlignment(collectChordLyricPairs(decoded)).mode;
  const prepared =
    alignment === "proportional" ? realignToMono(decoded) : decoded;

  return {
    content: finalize(
      cleanWhiteSpace(openSongToChordPro(prepared.join("\n")).split("\n")).map(
        applyHeading,
      ),
    ),
    alignment,
  };
};

/** Re-space every chord line against the lyric beneath it. */
const realignToMono = (lines: string[]): string[] =>
  lines.map((line, i) => {
    if (!isOpenSongChordLine(line)) return line;

    const next = lines[i + 1];
    const canAttach =
      next !== undefined &&
      next.trim() !== "" &&
      next.trim() !== "-" &&
      !isOpenSongChordLine(next) &&
      !next.trim().startsWith("[");

    if (!canAttach) return line;

    return "." + realignChordLineToMono(line.slice(1), next);
  });

export const convertMWLData = (
  content: string,
  options: ConvertMWLOptions = {},
): string => convertMWLDataDetailed(content, options).content;

const applyHeading = (line: string): string => {
  const heading = headingOf(line);
  return heading ? `[${heading}]` : line;
};

/** MyWorshipList writes chords as "x00", "x09m7" placeholders */
const markChords = (lines: string[]): string[] =>
  lines.map((line) => (line.match(/x[01]/) ? "." + line : line));

const REPEAT_RE =
  /^\s*repeat\s*(verse|bridge|pre-? ?chorus|chorus|end|tag|intro) ?(\d+)?(.*)$/i;
const SOLO_RE = /^\s*solo\s*$/i;

const removeAuxiliaryText = (lines: string[]): string[] =>
  lines.filter((line) => !REPEAT_RE.test(line) && !SOLO_RE.test(line));
