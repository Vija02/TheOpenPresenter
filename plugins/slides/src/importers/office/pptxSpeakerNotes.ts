import { strFromU8, unzipSync } from "fflate";

import { decodeEntities } from "../speakerNotes";

const SLIDE_PATH = /^ppt\/slides\/slide(\d+)\.xml$/;
const NOTES_RELATIONSHIP_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide";

const attr = (tag: string, name: string): string | null =>
  tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;

/**
 * Resolves the notes part a slide points at, e.g.
 * `ppt/slides/_rels/slide2.xml.rels` -> `ppt/notesSlides/notesSlide2.xml`.
 */
const findNotesPartForSlide = (
  files: Record<string, Uint8Array>,
  slidePath: string,
): string | null => {
  const relsPath = slidePath.replace(
    /^ppt\/slides\/(slide\d+\.xml)$/,
    "ppt/slides/_rels/$1.rels",
  );
  const rels = files[relsPath];
  if (!rels) return null;

  for (const tag of strFromU8(rels).match(/<Relationship\b[^>]*>/g) ?? []) {
    if (attr(tag, "Type") !== NOTES_RELATIONSHIP_TYPE) continue;
    const target = attr(tag, "Target");
    if (!target) continue;
    // Targets are relative to ppt/slides/
    return `ppt/${target.replace(/^\.\.\//, "")}`;
  }

  return null;
};

/**
 * Pulls the text out of the notes body placeholder. A notes slide also carries
 * a thumbnail of the slide itself (`type="sldImg"`) and can carry the slide
 * number, so we only read the shape whose placeholder is the body.
 */
const readNotesBodyText = (xml: string): string => {
  const shapes = xml.split("<p:sp>").slice(1);
  const paragraphs: string[] = [];

  for (const shape of shapes) {
    if (!/<p:ph\b[^>]*type="body"/.test(shape)) continue;

    for (const paragraph of shape.match(/<a:p>[\s\S]*?<\/a:p>/g) ?? []) {
      const runs = paragraph.match(/<a:t>([\s\S]*?)<\/a:t>/g) ?? [];
      paragraphs.push(
        decodeEntities(
          runs.map((run) => run.replace(/<\/?a:t>/g, "")).join(""),
        ),
      );
    }
  }

  return paragraphs.join("\n");
};

/**
 * Reads the speaker notes of every slide in a .pptx, in slide order.
 * Returns null when the file isn't a readable OOXML package (e.g. legacy .ppt).
 */
export const extractPptxSpeakerNotes = (
  pptxBuffer: Buffer,
): string[] | null => {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(pptxBuffer));
  } catch {
    return null;
  }

  const presentationRels = files["ppt/_rels/presentation.xml.rels"];
  const presentation = files["ppt/presentation.xml"];
  if (!presentationRels || !presentation) return null;

  // The slide order lives in presentation.xml as relationship ids; the file a
  // given id points to is in the rels part. Neither is ordered by file name.
  const targetByRelId = new Map<string, string>();
  for (const tag of strFromU8(presentationRels).match(
    /<Relationship\b[^>]*>/g,
  ) ?? []) {
    const id = attr(tag, "Id");
    const target = attr(tag, "Target");
    if (!id || !target) continue;
    targetByRelId.set(id, `ppt/${target.replace(/^\.\.\//, "")}`);
  }

  const slidePaths: string[] = [];
  for (const tag of strFromU8(presentation).match(/<p:sldId\b[^>]*>/g) ?? []) {
    const relId = attr(tag, "r:id");
    const target = relId ? targetByRelId.get(relId) : null;
    if (target && SLIDE_PATH.test(target)) slidePaths.push(target);
  }

  if (slidePaths.length === 0) return null;

  return slidePaths.map((slidePath) => {
    const notesPath = findNotesPartForSlide(files, slidePath);
    const notes = notesPath ? files[notesPath] : undefined;
    return notes ? readNotesBodyText(strFromU8(notes)) : "";
  });
};
