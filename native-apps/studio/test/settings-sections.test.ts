import { describe, expect, it } from "vitest";

import { SECTIONS as SCREENS_SECTIONS } from "../src/renderer/screens/Screens";
import { SECTIONS } from "../src/renderer/settings/Settings";
import { sectionFromHash } from "../src/renderer/shared/SectionedWindow";

describe("sectionFromHash", () => {
  it("recognises every section the menu can open", () => {
    expect(sectionFromHash(SECTIONS, "#server")).toBe("server");
    expect(sectionFromHash(SECTIONS, "#runtime")).toBe("runtime");
    expect(sectionFromHash(SECTIONS, "#remote")).toBe("remote");
    expect(sectionFromHash(SECTIONS, "#about")).toBe("about");
    expect(sectionFromHash(SCREENS_SECTIONS, "#virtual")).toBe("virtual");
  });

  /** A typo in a hash should still open something useful. */
  it("falls back to the first section rather than dead-ending", () => {
    expect(sectionFromHash(SECTIONS, "#screens")).toBe("server");
    expect(sectionFromHash(SECTIONS, "#runtimee")).toBe("server");
    expect(sectionFromHash(SECTIONS, "#")).toBe("server");
    expect(sectionFromHash(SECTIONS, "")).toBe("server");
  });

  it.each([
    ["settings", SECTIONS],
    ["screens", SCREENS_SECTIONS],
  ] as const)(
    "gives every %s section a label, a hint and its own hash",
    (_, sections) => {
      for (const section of sections) {
        expect(sectionFromHash(sections, `#${section.id}`)).toBe(section.id);
        expect(section.label.length).toBeGreaterThan(0);
        expect(section.hint.length).toBeGreaterThan(0);
      }
    },
  );
});
