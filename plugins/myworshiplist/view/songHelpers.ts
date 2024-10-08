import { SongCache } from "../src";

export const removeChords = (content: string[]) => {
  return content.reduce((acc, val) => {
    return val.match(/x[01]/) ? acc : [...acc, val];
  }, [] as string[]);
};
export const cleanWhiteSpace = (content: string[]) => {
  return content.map((x) => x.replace(/\s+/g, " ").trim());
};
export const removeAuxiliaryText = (content: string[]) => {
  return content.filter((songLine) => {
    const match1 = songLine.match(
      /^(\s*)repeat(\s*)(verse|bridge|pre-? ?chorus|chorus|end|tag|intro)? ?(\d+)?(.*)$/i,
    );

    if (match1 && match1?.length > 0) {
      return false;
    }

    const match2 = songLine.match(/^(\s*)solo(\s*)$/i);

    if (match2 && match2?.length > 0) {
      return false;
    }

    return true;
  });
};

export const groupData = (content: string[]) => {
  let heading = "Unknown";
  const map: Record<string, string[]> = {};

  for (const songLine of content) {
    const matches = songLine.match(
      /^(\s*)\[?(verse|bridge|pre-? ?chorus|chorus|end|ending|outro|tag|instrumental) ?(\d+)?\]?(\s*)$/i,
    );
    if (matches && matches?.length > 1) {
      heading = matches[0];
    } else {
      if (!map[heading]) map[heading] = [];
      map[heading]?.push(songLine);
    }
  }

  return map;
};

export const processSongCache = (songCache?: SongCache) => {
  const cleanData = removeAuxiliaryText(
    cleanWhiteSpace(removeChords(songCache?.content.split("<br>") ?? [])),
  );

  const groupedData = groupData(cleanData);

  return groupedData;
};
