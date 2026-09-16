import {
  chordLineCanAttach,
  isOpenSongChordLine,
} from "../convert/openSongToChordPro";
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

/** Re-space every OpenSong chord line in `lines` against the lyric beneath it. */
export const realignChordLines = (lines: string[]): string[] =>
  lines.map((line, i) => {
    if (!isOpenSongChordLine(line)) return line;

    const next = lines[i + 1];
    if (!chordLineCanAttach(next)) return line;

    return "." + realignChordLineToMono(line.slice(1), next!);
  });
