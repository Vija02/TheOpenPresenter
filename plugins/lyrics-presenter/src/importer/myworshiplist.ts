import { cleanWhiteSpace, finalize, headingOf, splitLines } from "./shared";

export const convertMWLData = (content: string): string => {
  const lines = removeAuxiliaryText(
    cleanWhiteSpace(markChords(splitLines(content))),
  ).map((line) => {
    const heading = headingOf(line);
    return heading ? `[${heading}]` : line;
  });

  return finalize(lines);
};

/** MyWorshipList writes chords as "x00", "x09m7" placeholders */
const markChords = (lines: string[]): string[] =>
  lines.map((line) => (line.match(/x[01]/) ? "." + line : line));

const REPEAT_RE =
  /^\s*repeat\s*(verse|bridge|pre-? ?chorus|chorus|end|tag|intro) ?(\d+)?(.*)$/i;
const SOLO_RE = /^\s*solo\s*$/i;

const removeAuxiliaryText = (lines: string[]): string[] =>
  lines.filter((line) => !REPEAT_RE.test(line) && !SOLO_RE.test(line));
