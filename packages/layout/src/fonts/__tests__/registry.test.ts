import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BUNDLED_FONTS,
  SYSTEM_FONTS,
  findFontOption,
  getFontOptions,
  organizationFontStack,
  setOrganizationFonts,
  subscribeToFontOptions,
} from "../registry";

afterEach(() => setOrganizationFonts([]));

describe("organization fonts", () => {
  const lora = {
    family: "Lora",
    category: "serif",
    cssUrl: "/media/data/a.css",
  };

  it("sit between the bundled and system fonts", () => {
    setOrganizationFonts([lora]);
    const options = getFontOptions();
    expect(options.map((f) => f.source)).toEqual([
      ...BUNDLED_FONTS.map(() => "bundled"),
      "organization",
      ...SYSTEM_FONTS.map(() => "system"),
    ]);
    expect(options[BUNDLED_FONTS.length]).toMatchObject({
      label: "Lora",
      family: "Lora",
      stack: '"Lora", Georgia, serif',
      cssUrl: "/media/data/a.css",
    });
  });

  it("list a family once, even if the organization has it twice", () => {
    setOrganizationFonts([lora, { ...lora, cssUrl: "/media/data/b.css" }]);
    const ours = getFontOptions().filter((f) => f.source === "organization");
    expect(ours.map((f) => f.cssUrl)).toEqual(["/media/data/a.css"]);
  });

  it("resolve a stack by its primary family", () => {
    expect(findFontOption('"Lora", serif')).toBeUndefined();
    setOrganizationFonts([lora]);
    expect(findFontOption("'Lora', serif")?.source).toBe("organization");
  });

  it("tell subscribers when they change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToFontOptions(listener);
    setOrganizationFonts([lora]);
    unsubscribe();
    setOrganizationFonts([]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("never let a family name break out of its quotes", () => {
    expect(organizationFontStack('Evil", x', "unknown")).toBe(
      '"Evil, x", system-ui, sans-serif',
    );
  });
});
