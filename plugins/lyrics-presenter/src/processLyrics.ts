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
export const ungroupData = (groupedData: GroupedData): string[] => {
  let data = "";

  for (const group of groupedData) {
    data += `[${group.heading}]` + "\n";

    data += group.slides.map((slide) => slide.join("\n")).join("\n-\n") + "\n";
  }

  return data.split("\n");
};

export const removeChords = (content: string[]) => {
  return content.reduce((acc, val) => {
    return val.startsWith(".") ? acc : [...acc, val];
  }, [] as string[]);
};
