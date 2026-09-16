import { isChordToken } from "./chords/chord";
import { hasInlineChords, stripInlineChords } from "./chords/chordpro";

export type GroupedData = {
  heading: string;
  slides: string[][];
}[];

const isHeading = (line: string): boolean =>
  line.startsWith("[") &&
  line.endsWith("]") &&
  line.indexOf("]") === line.length - 1 &&
  !isChordToken(line.slice(1, -1));

export const groupData = (content: string[]): GroupedData => {
  const group = [];

  for (const songLine of content) {
    if (isHeading(songLine)) {
      group.push({ heading: songLine.slice(1, -1), slides: [[]] });
    } else if (songLine === "-") {
      group[group.length - 1]?.slides.push([]);
    } else {
      if (group.length === 0) {
        group.push({ heading: "Unknown", slides: [[] as string[]] });
      }

      group[group.length - 1]?.slides[
        group[group.length - 1]!.slides.length - 1
      ]?.push(songLine);
    }
  }

  return group;
};
export const ungroupData = (groupedData: GroupedData): string[] => {
  let data = "";

  for (const group of groupedData) {
    data += `[${group.heading}]` + "\n";

    data += group.slides.map((slide) => slide.join("\n")).join("\n-\n") + "\n";
  }

  return data.split("\n");
};

export const removeChords = (content: string[]) => {
  const out: string[] = [];

  for (const line of content) {
    if (line.startsWith(".")) continue;

    if (!hasInlineChords(line)) {
      out.push(line);
      continue;
    }

    const stripped = stripInlineChords(line);
    if (stripped.trim() === "") continue;

    out.push(stripped);
  }

  return out;
};
