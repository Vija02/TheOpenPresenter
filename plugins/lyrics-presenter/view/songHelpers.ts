import { groupData, removeChords } from "../src/processLyrics";

export const cleanWhiteSpace = (content: string[]) => {
  return content.map((x) => x.replace(/\s+/g, " ").trim());
};

export const processSong = (content: string) => {
  const cleanData = cleanWhiteSpace(
    removeChords(content.split(/<br>|\n/gm) ?? []),
  );

  const groupedData = groupData(cleanData);

  return groupedData;
};
