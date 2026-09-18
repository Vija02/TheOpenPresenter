import { strToU8, zipSync } from "fflate";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { extractSlideData } from "../googleSlides/slideData/slideDataExtractor";
import { extractPptxSpeakerNotes } from "../office/pptxSpeakerNotes";
import { htmlNotesToPlainText, normalizeSpeakerNotes } from "../speakerNotes";

const repoRoot = join(__dirname, "../../../../..");

describe("htmlNotesToPlainText", () => {
  it("turns Google's styled note HTML into plain text", () => {
    const html =
      '<p style="font-weight:400;font-family:Arial;">Say hello &amp; smile</p>' +
      '<p style="font-weight:400;">Then read John&nbsp;3:16</p>';

    expect(htmlNotesToPlainText(html)).toBe(
      "Say hello & smile\nThen read John 3:16",
    );
  });

  it("keeps line breaks and decodes numeric entities", () => {
    expect(htmlNotesToPlainText("<p>one<br>two &#8212; three</p>")).toBe(
      "one\ntwo — three",
    );
  });

  it("returns an empty string for an empty note", () => {
    expect(htmlNotesToPlainText('<p style="x"><span></span></p>')).toBe("");
  });
});

describe("normalizeSpeakerNotes", () => {
  it("drops the field entirely when no slide has notes", () => {
    expect(normalizeSpeakerNotes(["", "  ", ""])).toBeUndefined();
  });

  it("keeps the empty entries when at least one slide has notes", () => {
    expect(normalizeSpeakerNotes(["", " hi ", ""])).toEqual(["", "hi", ""]);
  });
});

describe("extractSlideData speaker notes", () => {
  it("reads notes off the real Google Slides embed HTML", () => {
    const html = readFileSync(
      join(repoRoot, "e2e/sample-files/sample.html"),
      "utf8",
    );
    const slideData = extractSlideData(html);

    expect(slideData).not.toBeNull();
    expect(slideData!.slides.map((s) => s.speakerNotes)).toHaveLength(
      slideData!.slides.length,
    );
  });
});

const notesPart = (text: string) =>
  `<p:notes><p:cSld><p:spTree>` +
  `<p:sp><p:nvSpPr><p:nvPr><p:ph idx="2" type="sldImg"/></p:nvPr></p:nvSpPr>` +
  `<p:txBody><a:p><a:r><a:t>not the notes</a:t></a:r></a:p></p:txBody></p:sp>` +
  `<p:sp><p:nvSpPr><p:nvPr><p:ph idx="1" type="body"/></p:nvPr></p:nvSpPr>` +
  `<p:txBody>${text
    .split("\n")
    .map((line) => `<a:p><a:r><a:t>${line}</a:t></a:r></a:p>`)
    .join("")}</p:txBody></p:sp>` +
  `</p:spTree></p:cSld></p:notes>`;

/** Minimal .pptx carrying just what the notes extractor reads. */
const buildPptx = (slides: (string | null)[]): Buffer => {
  const files: Record<string, Uint8Array> = {};

  const presentationRels = slides
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`,
    )
    .join("");

  files["ppt/_rels/presentation.xml.rels"] = strToU8(
    `<Relationships>${presentationRels}</Relationships>`,
  );
  // Slide order comes from sldIdLst, not the file names.
  files["ppt/presentation.xml"] = strToU8(
    `<p:presentation><p:sldIdLst>${slides
      .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`)
      .join("")}</p:sldIdLst></p:presentation>`,
  );

  slides.forEach((notes, i) => {
    const n = i + 1;
    files[`ppt/slides/slide${n}.xml`] = strToU8("<p:sld/>");
    files[`ppt/slides/_rels/slide${n}.xml.rels`] = strToU8(
      `<Relationships>` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
        (notes === null
          ? ""
          : `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${n}.xml"/>`) +
        `</Relationships>`,
    );
    if (notes !== null) {
      files[`ppt/notesSlides/notesSlide${n}.xml`] = strToU8(notesPart(notes));
    }
  });

  return Buffer.from(zipSync(files));
};

describe("extractPptxSpeakerNotes", () => {
  it("returns null for something that isn't a pptx", () => {
    expect(extractPptxSpeakerNotes(Buffer.from("not a zip"))).toBeNull();
  });

  it("reads the notes body of each slide, in slide order", () => {
    const notes = extractPptxSpeakerNotes(
      buildPptx(["First note", null, "Third note"]),
    );

    expect(notes).toEqual(["First note", "", "Third note"]);
  });

  it("keeps paragraph breaks and decodes escaped characters", () => {
    const notes = extractPptxSpeakerNotes(
      buildPptx(["Read John 3:16\nThen pray &amp; sit down"]),
    );

    expect(notes).toEqual(["Read John 3:16\nThen pray & sit down"]);
  });

  it("returns one entry per slide for the real fixture deck", () => {
    const pptx = readFileSync(join(repoRoot, "e2e/dummyFiles/dummySlide.pptx"));

    expect(extractPptxSpeakerNotes(pptx)).toEqual(["", ""]);
  });
});
