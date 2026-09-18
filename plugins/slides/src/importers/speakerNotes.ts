const PARAGRAPH_BOUNDARY = /<\/p>|<br\s*\/?>/gi;

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export const decodeEntities = (text: string): string =>
  text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match;
  });

/** Google Slides gives us speaker notes as styled HTML. We keep the notes as plain text */
export const htmlNotesToPlainText = (html: string): string =>
  decodeEntities(
    html
      .replace(PARAGRAPH_BOUNDARY, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/\r/g, ""),
  )
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const normalizeSpeakerNotes = (
  notes: string[],
): string[] | undefined => {
  const trimmed = notes.map((note) => note.trim());
  return trimmed.some((note) => note.length > 0) ? trimmed : undefined;
};
