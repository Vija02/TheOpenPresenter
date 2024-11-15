export const removeChords = (content: string[]) => {
  return content.reduce((acc, val) => {
    return val.startsWith(".") ? acc : [...acc, val];
  }, [] as string[]);
};
export const cleanWhiteSpace = (content: string[]) => {
  return content.map((x) => x.replace(/\s+/g, " ").trim());
};

export type GroupedData = {
  heading: string;
  slides: string[][];
}[];

export const groupData = (content: string[]): GroupedData => {
  const group = [];

  for (const songLine of content) {
    if (songLine.startsWith("[") && songLine.endsWith("]")) {
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

export const processSong = (content: string) => {
  const cleanData = cleanWhiteSpace(
    removeChords(content.split(/<br>|\n/gm) ?? []),
  );

  const groupedData = groupData(cleanData);

  return groupedData;
};
