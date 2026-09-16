import { describe, expect, it } from "vitest";

import {
  contentHasMwlChordCodes,
  decodeMwlChords,
  isMwlChordCode,
} from "../mwlChords";

describe("decodeMwlChords", () => {
  it("decodes offsets against the song key", () => {
    // "Who Else" is in Ab: x00 = Ab, x07 = Eb, x09m7 = Fm7.
    expect(decodeMwlChords("x00", "Ab")).toBe("Ab");
    expect(decodeMwlChords("x07", "Ab")).toBe("Eb");
    expect(decodeMwlChords("x09m7", "Ab")).toBe("Fm7");
  });

  it("spells with the accidental the key implies", () => {
    expect(decodeMwlChords("x03", "Ab")).toBe("B");
    expect(decodeMwlChords("x01", "A")).toBe("A#");
  });

  it("keeps the surrounding spacing", () => {
    expect(decodeMwlChords("  x00     x07", "G")).toBe("  G     D");
  });

  it("decodes both halves of a slash chord", () => {
    expect(decodeMwlChords("x05/x00", "A")).toBe("D/A");
  });

  it("leaves the text alone without a key", () => {
    expect(decodeMwlChords("x00 x07", null)).toBe("x00 x07");
  });
});

describe("isMwlChordCode", () => {
  it("matches a placeholder at the start of the token", () => {
    expect(isMwlChordCode("x00")).toBe(true);
    expect(isMwlChordCode("x09m7")).toBe(true);
  });

  it("does not match a bar line that merely contains one", () => {
    expect(isMwlChordCode("|x00")).toBe(false);
    expect(isMwlChordCode("G")).toBe(false);
  });
});

describe("contentHasMwlChordCodes", () => {
  it("detects placeholders anywhere in the content", () => {
    expect(contentHasMwlChordCodes("hello\n x00\nworld")).toBe(true);
    expect(contentHasMwlChordCodes("hello\n[G]world")).toBe(false);
  });
});
