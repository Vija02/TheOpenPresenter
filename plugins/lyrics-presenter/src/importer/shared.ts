import { stripInlineChords } from "../chords/chordpro";
import { groupData, ungroupData } from "../processLyrics";

const SECTION_WORDS =
  "verse|bridge|pre-? ?chorus|chorus|end|ending|outro|tag|instrumental|interlude|intro|vamp|refrain|coda|turnaround|breakdown|hook|rap|channel|misc";

/** "VERSE 1", "Chorus:", "[Pre-Chorus 2]" */
const HEADING_RE = new RegExp(
  `^\\s*\\[?(${SECTION_WORDS})\\s*(\\d+)?\\s*:?\\]?\\s*$`,
  "i",
);

export const isSectionWord = (text: string) => HEADING_RE.test(text);

export const headingOf = (line: string): string | null =>
  isSectionWord(line) ? line.replace(/[[\]:]/g, "").trim() : null;

export const splitLines = (content: string): string[] =>
  (content ?? "").split(/<br>|\r\n|\r|\n/);

export const cleanWhiteSpace = (lines: string[]): string[] =>
  lines.map((line) => line.replace(/\s+/g, " ").trim());

export const finalize = (lines: string[]): string => {
  const grouped = groupData(lines).filter((group) =>
    group.slides.flat().some(hasContent),
  );

  return ungroupData(grouped).join("\n").trim();
};

/** A line worth keeping: a lyric, or an OpenSong chord line like an intro. */
const hasContent = (line: string): boolean =>
  line.startsWith(".")
    ? line.slice(1).trim() !== ""
    : stripInlineChords(line).trim() !== "";
