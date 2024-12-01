import { GroupedData, groupData, removeChords } from "../src/processLyrics";

export const cleanWhiteSpace = (content: string[]) => {
  return content.map((x) => x.replace(/\s+/g, " ").trim());
};

export const suppressStartAndEndEmptyLines = (groupedData: GroupedData) => {
  return groupedData.map((group) => ({
    ...group,
    slides: group.slides.map((slide) =>
      slide
        .filter((x, i, all) => {
          if (x !== "") return true;

          // Trim line breaks to maximum of 1 space
          return i < all.length - 1 && all[i + 1] === "" ? false : true;
        })
        .filter((x, i, all) => {
          if (x !== "") return true;
          // Remove start and end lines
          if (i === 0 || i === all.length - 1) {
            return false;
          }
          return true;
        })
        // Replace empty lines with no-break space so that svg renders the height without showing anything
        // https://www.fileformat.info/info/unicode/char/a0/index.htm
        .map((x) => (x === "" ? "\u00A0" : x)),
    ),
  }));
};

export const processSong = (content: string) => {
  const cleanData = cleanWhiteSpace(
    removeChords(content.split(/<br>|\n/gm) ?? []),
  );

  const groupedData = groupData(cleanData);

  return suppressStartAndEndEmptyLines(groupedData);
};
