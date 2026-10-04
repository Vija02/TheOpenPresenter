/**
 * Every slide's notes as one editable text. Each slide's section starts with a
 * separator line, `--- Slide N`. Only the leading `---` is read back; the label
 * is a guide for the person editing.
 */
const SEPARATOR = /^---(\s.*)?$/;

export const joinAllNotes = (notes: string[]): string =>
  notes.map((text, i) => `--- Slide ${i + 1}\n${text.trim()}`).join("\n\n");

export type SplitResult =
  | { ok: true; notes: string[] }
  | { ok: false; error: string };

/** Reads text written by `joinAllNotes` back into one entry per slide. */
export const splitAllNotes = (
  text: string,
  slideCount: number,
): SplitResult => {
  const sections: string[][] = [];
  const beforeFirst: string[] = [];

  for (const line of text.split("\n")) {
    if (SEPARATOR.test(line.trim())) {
      sections.push([]);
    } else {
      (sections[sections.length - 1] ?? beforeFirst).push(line);
    }
  }

  if (beforeFirst.join("").trim() !== "") {
    return {
      ok: false,
      error: "Text above the first --- line doesn't belong to a slide.",
    };
  }
  if (sections.length !== slideCount) {
    return {
      ok: false,
      error: `Found ${sections.length} --- lines, expected one per slide (${slideCount}).`,
    };
  }
  return { ok: true, notes: sections.map((lines) => lines.join("\n").trim()) };
};
