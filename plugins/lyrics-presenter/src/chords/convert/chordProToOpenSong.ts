import { hasInlineChords, tokenizeChordPro } from "../chordpro";

/** Render a ChordPro line as OpenSong wants it */
export const chordProLineToOpenSong = (
  line: string,
): { chordLine: string; lyricLine: string } | null => {
  if (!hasInlineChords(line)) return null;

  let chordLine = "";
  let lyricLine = "";

  for (const token of tokenizeChordPro(line)) {
    if (token.type === "text") {
      lyricLine += token.value;
      continue;
    }

    // Pad out to where the chord belongs. A chord that would touch the
    // previous one is pushed one space clear of it.
    const minimum = chordLine.length === 0 ? 0 : chordLine.length + 1;
    const target = Math.max(lyricLine.length, minimum);
    chordLine = chordLine.padEnd(target, " ") + token.value;
  }

  return { chordLine: chordLine.trimEnd(), lyricLine };
};

/** Convert ChordPro content back to OpenSong dot-prefixed chord lines. */
export const chordProToOpenSong = (content: string): string => {
  const out: string[] = [];

  for (const line of content.split("\n")) {
    const converted = chordProLineToOpenSong(line);
    if (!converted) {
      out.push(line);
      continue;
    }

    if (converted.chordLine) out.push("." + converted.chordLine);
    if (converted.lyricLine.trim()) out.push(converted.lyricLine);
  }

  return out.join("\n");
};
