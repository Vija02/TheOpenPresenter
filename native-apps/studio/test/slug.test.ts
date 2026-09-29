import { describe, expect, it } from "vitest";

import { toSlug, uniqueSlug } from "../src/main/cloud/slug";

describe("toSlug", () => {
  it("turns a name into something a server will accept", () => {
    expect(toSlug("St Mary's Chapel")).toBe("st-marys-chapel");
    expect(toSlug("Grace Church")).toBe("grace-church");
    expect(toSlug("  Spaces  Everywhere  ")).toBe("spaces-everywhere");
  });

  it("drops accents rather than emitting them", () => {
    expect(toSlug("Iglesia Peñón")).toBe("iglesia-penon");
  });

  /**
   * The cases bare slugify gets wrong unattended: "" for a name with no Latin
   * characters, which the database accepts as an unreachable URL.
   */
  it("always produces something legal", () => {
    expect(toSlug("!!!")).toMatch(/^[a-z]/);
    expect(toSlug("")).toMatch(/^[a-z]/);
    expect(toSlug("123")).toMatch(/^[a-z]/);
    expect(toSlug("我的教会")).toMatch(/^[a-z]/);
  });

  it("stays within a sane length", () => {
    expect(toSlug("x".repeat(200)).length).toBeLessThanOrEqual(48);
  });
});

describe("uniqueSlug", () => {
  it("leaves a free slug alone", () => {
    expect(uniqueSlug("grace", [])).toBe("grace");
    expect(uniqueSlug("grace", ["other"])).toBe("grace");
  });

  /** Two cloud orgs can share a name, and one install may mirror both. */
  it("disambiguates a taken slug", () => {
    expect(uniqueSlug("grace", ["grace"])).toBe("grace-2");
    expect(uniqueSlug("grace", ["grace", "grace-2"])).toBe("grace-3");
  });

  it("never returns something already taken", () => {
    const taken = [
      "grace",
      ...Array.from({ length: 50 }, (_, i) => `grace-${i + 2}`),
    ];
    expect(taken).not.toContain(uniqueSlug("grace", taken));
  });
});
