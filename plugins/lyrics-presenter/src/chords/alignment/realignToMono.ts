import { proportionalIndex } from "./detectAlignment";

/** Rewrite proportionally-aligned **arial** chord lines as monospace ones */
export const realignChordLineToMono = (
  chordText: string,
  lyricLine: string,
): string => {
  let out = "";

  for (const match of chordText.matchAll(/\S+/g)) {
    const target = proportionalIndex(chordText, match.index, lyricLine);

    // Never let a chord overwrite the previous one.
    // A single space is the minimum separation.
    const column = Math.max(target, out.length === 0 ? 0 : out.length + 1);
    out = out.padEnd(column, " ") + match[0];
  }

  return out;
};
