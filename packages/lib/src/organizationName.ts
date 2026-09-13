const minorWords = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "in",
  "of",
  "on",
  "the",
  "to",
  "with",
]);

/**
 * Words already containing a capital are left alone, which keeps acronyms and
 * deliberate styling intact (CLC, St Peter's, McDonald). Small joining words
 * are lowercased unless they lead the name.
 */
export const titleCaseOrganizationName = (input: string): string => {
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (trimmed === "") return "";

  return trimmed
    .split(" ")
    .map((word, index) => {
      if (/[A-Z]/.test(word)) return word;

      const lower = word.toLowerCase();
      if (index > 0 && minorWords.has(lower)) return lower;

      return lower.replace(
        /(^|[\s\-".(/])([a-z])/g,
        (_, prefix: string, letter: string) => prefix + letter.toUpperCase(),
      );
    })
    .join(" ");
};
