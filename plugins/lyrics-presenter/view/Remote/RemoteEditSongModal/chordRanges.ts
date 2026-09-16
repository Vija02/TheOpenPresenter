import { isChordToken } from "../../../src/chords/chord";

/** Character ranges of every inline [chord] in a line, relative to the line. */
export const inlineChordRanges = (
  text: string,
): { from: number; to: number }[] => {
  const trimmed = text.trim();
  const isSectionHeading =
    trimmed.startsWith("[") &&
    trimmed.endsWith("]") &&
    trimmed.indexOf("]") === trimmed.length - 1 &&
    !isChordToken(trimmed.slice(1, -1));

  if (isSectionHeading) return [];

  const ranges: { from: number; to: number }[] = [];
  const re = /\[([^\]]*)\]/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (!isChordToken(match[1] ?? "")) continue;
    ranges.push({ from: match.index, to: match.index + match[0].length });
  }

  return ranges;
};
