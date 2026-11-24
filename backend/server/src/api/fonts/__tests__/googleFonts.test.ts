// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  GoogleFontFamily,
  css2FamilyParam,
  extractFontFileUrls,
  mapLimited,
  parseCatalog,
  renamePreviewFamily,
  rewriteFontFileUrls,
} from "../googleFonts";

const family = (over: Partial<GoogleFontFamily>): GoogleFontFamily => ({
  family: "Test",
  category: "sans",
  styles: ["400"],
  weightAxis: null,
  googleCategory: "Sans Serif",
  axisCount: 0,
  designers: [],
  popularity: 1,
  primaryScript: "",
  hasLatin: true,
  ...over,
});

describe("parseCatalog", () => {
  it("reads families with or without the anti-hijacking prefix", () => {
    const body =
      ")]}'\n" +
      JSON.stringify({
        familyMetadataList: [
          {
            family: "Inter",
            category: "Sans Serif",
            designers: ["Rasmus Andersson"],
            popularity: 5,
            subsets: ["menu", "latin"],
            fonts: { "400": {}, "400i": {} },
            axes: [
              { tag: "opsz", min: 14, max: 32 },
              { tag: "wght", min: 100, max: 900 },
            ],
          },
          {
            family: "Caveat Brush",
            category: "Handwriting",
            primaryScript: "Thai",
            subsets: ["thai"],
            fonts: { "400": {} },
          },
        ],
      });
    expect(parseCatalog(body.slice(5))).toEqual(parseCatalog(body));
    expect(parseCatalog(body)).toEqual([
      {
        family: "Inter",
        category: "sans",
        styles: ["400", "400i"],
        weightAxis: { min: 100, max: 900 },
        googleCategory: "Sans Serif",
        axisCount: 2,
        designers: ["Rasmus Andersson"],
        popularity: 5,
        primaryScript: "",
        hasLatin: true,
      },
      {
        family: "Caveat Brush",
        category: "display",
        styles: ["400"],
        weightAxis: null,
        googleCategory: "Handwriting",
        axisCount: 0,
        designers: [],
        popularity: Number.MAX_SAFE_INTEGER,
        primaryScript: "Thai",
        hasLatin: false,
      },
    ]);
  });
});

describe("css2FamilyParam", () => {
  it("asks a variable family for its whole weight range, both styles", () => {
    expect(
      css2FamilyParam(
        family({
          family: "Roboto Slab",
          styles: ["400", "700i"],
          weightAxis: { min: 100, max: 900 },
        }),
      ),
    ).toBe("Roboto+Slab:ital,wght@0,100..900;1,100..900");
  });

  it("asks a variable family without italics for upright only", () => {
    expect(
      css2FamilyParam(family({ weightAxis: { min: 200, max: 800 } })),
    ).toBe("Test:wght@200..800");
  });

  it("lists every static style, sorted as css2 requires", () => {
    expect(
      css2FamilyParam(
        family({ family: "Lato", styles: ["700i", "400", "100i", "700"] }),
      ),
    ).toBe("Lato:ital,wght@0,400;0,700;1,100;1,700");
  });

  it("lists static weights alone when there are no italics", () => {
    expect(css2FamilyParam(family({ styles: ["700", "300"] }))).toBe(
      "Test:wght@300;700",
    );
  });
});

describe("font file urls", () => {
  const css = `
@font-face {
  font-family: 'Lato';
  src: url(https://fonts.gstatic.com/s/lato/v24/a.woff2) format('woff2');
  unicode-range: U+0100-02BA;
}
@font-face {
  font-family: 'Lato';
  src: url(https://fonts.gstatic.com/s/lato/v24/b.woff2) format('woff2');
}
@font-face {
  font-family: 'Lato';
  src: url(https://fonts.gstatic.com/s/lato/v24/a.woff2) format('woff2');
}`;

  it("finds each file once", () => {
    expect(extractFontFileUrls(css)).toEqual([
      "https://fonts.gstatic.com/s/lato/v24/a.woff2",
      "https://fonts.gstatic.com/s/lato/v24/b.woff2",
    ]);
  });

  it("points every face at our copy and keeps the rest", () => {
    const out = rewriteFontFileUrls(
      css,
      new Map([
        ["https://fonts.gstatic.com/s/lato/v24/a.woff2", "/media/data/a.woff2"],
        ["https://fonts.gstatic.com/s/lato/v24/b.woff2", "/media/data/b.woff2"],
      ]),
    );
    expect(out).not.toContain("gstatic");
    expect(out.match(/\/media\/data\/a\.woff2/g)).toHaveLength(2);
    expect(out).toContain("unicode-range: U+0100-02BA;");
  });
});

describe("mapLimited", () => {
  it("keeps order and never runs more than the limit", async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimited([1, 2, 3, 4, 5], 2, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBe(2);
  });

  it("stops starting work after a failure, but waits for running work", async () => {
    const finished: number[] = [];
    const run = mapLimited([1, 2, 3, 4, 5], 2, async (n) => {
      if (n === 1) throw new Error("boom");
      await new Promise((r) => setTimeout(r, 20));
      finished.push(n);
      return n;
    });
    await expect(run).rejects.toThrow("boom");
    // 2 was already running; nothing after it started
    expect(finished).toEqual([2]);
  });
});

describe("renamePreviewFamily", () => {
  it("renames every face so it cannot stand in for the real family", () => {
    const css = `@font-face {
  font-family: 'Lora';
  src: url(https://fonts.gstatic.com/l/font?kit=a) format('woff2');
}
@font-face {
  font-family: "Lora";
  font-style: italic;
}`;
    const out = renamePreviewFamily(css, "Lora");
    expect(out.match(/font-family: 'Lora Preview';/g)).toHaveLength(2);
    expect(out).not.toMatch(/font-family:\s*['"]Lora['"]/);
    expect(out).toContain("url(https://fonts.gstatic.com/l/font?kit=a)");
  });
});
