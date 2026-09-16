import { isOpenSongChordLine } from "../chords/convert/openSongToChordPro";
import { contentHasMwlChordCodes, decodeMwlChords } from "./mwlChords";

/**
 * Songs imported before we decoded chords still hold MyWorshipList placeholders
 * on OpenSong chord lines:
 *
 *   [Verse 1]
 *   .x07 x09m x00/x04 x05
 *   Sin was stained on me
 */

export const contentNeedsChordUpgrade = (content: string): boolean =>
  contentHasMwlChordCodes(content);

export const upgradeMwlChordCodes = (
  content: string,
  key: string | null | undefined,
): string => {
  if (!key || !contentNeedsChordUpgrade(content)) return content;

  return content
    .split("\n")
    .map((line) =>
      isOpenSongChordLine(line)
        ? "." + decodeMwlChords(line.slice(1), key)
        : line,
    )
    .join("\n");
};
