import { groupData, ungroupData } from "../processLyrics";

export const convertMWLData = (content: string) => {
  const raw = convertHeading(
    removeAuxiliaryText(
      cleanWhiteSpace(convertChords(content.split(/<br>|\n/gm) ?? [])),
    ),
  );

  const grouped = groupData(raw);
  // Remove slides that are empty
  const processed = grouped.filter(
    (x) =>
      x.slides
        .flat()
        .filter((j) => !j.startsWith("."))
        .join("") !== "",
  );

  return ungroupData(processed).join("\n");
};

const convertChords = (content: string[]) => {
  return content.map((val) => {
    return val.match(/x[01]/) ? "." + val : val;
  });
};
const cleanWhiteSpace = (content: string[]) => {
  return content.map((x) => x.replace(/\s+/g, " ").trim());
};
const removeAuxiliaryText = (content: string[]) => {
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
const convertHeading = (content: string[]) => {
  return content.map((val) => {
    const matches = val.match(
      /^(\s*)\[?(verse|bridge|pre-? ?chorus|chorus|end|ending|outro|tag|instrumental|interlude|intro) ?(\d+)?\]?(\s*)$/i,
    );
    return matches ? "[" + val.replace(/[\[\]]/g, "") + "]" : val;
  });
};
