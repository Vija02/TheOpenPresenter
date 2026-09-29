import { describe, expect, it } from "vitest";

import { SECTIONS, sectionFromHash } from "../src/renderer/settings/Settings";

describe("sectionFromHash", () => {
  it("recognises every section the menu can open", () => {
    expect(sectionFromHash("#server")).toBe("server");
    expect(sectionFromHash("#runtime")).toBe("runtime");
    expect(sectionFromHash("#remote")).toBe("remote");
    expect(sectionFromHash("#about")).toBe("about");
  });

  /**
   * A typo in a hash should still open Settings on something useful. The old
   * separate-window design showed an "unknown panel" dead end; with one window
   * the honest fallback is simply the first section.
   */
  it("falls back to the first section rather than dead-ending", () => {
    expect(sectionFromHash("#onboarding")).toBe("server");
    expect(sectionFromHash("#runtimee")).toBe("server");
    expect(sectionFromHash("#")).toBe("server");
    expect(sectionFromHash("")).toBe("server");
  });

  /** Every section needs a hash the menu can actually target. */
  it("can round-trip every section id", () => {
    for (const section of SECTIONS) {
      expect(sectionFromHash(`#${section.id}`)).toBe(section.id);
    }
  });

  it("gives every section a label and a hint", () => {
    for (const section of SECTIONS) {
      expect(section.label.length).toBeGreaterThan(0);
      expect(section.hint.length).toBeGreaterThan(0);
    }
  });
});
