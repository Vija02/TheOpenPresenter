import type { BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { extractSlideData } from "../../plugins/slides/src/importers/googleSlides/slideData/slideDataExtractor";
import { normalizeSlide } from "../../plugins/slides/src/office/normalize";
import {
  compileTimeline,
  navigationTiming,
} from "../../plugins/slides/src/office/timeline";
import { transitionPlayback } from "../../plugins/slides/src/office/transitions";

const SAMPLE_HTML_PATH = join(__dirname, "../sample-files/sample.html");

// Stable ids so seeded slideOrder refs and screenshots are deterministic.
const IMPORT_ID = "import_e2egslides";

/** One per slide in the sample deck, so an offset lands on a different note. */
export const SAMPLE_SPEAKER_NOTES = [
  "Notes for slide one",
  "Notes for slide two",
  "Notes for slide three",
  "Notes for slide four",
];

export type SeedScene = {
  pluginName: string;
  pluginData: Record<string, any>;
  rendererPluginData?: Record<string, any>;
  activate?: boolean;
  name?: string;
};

/**
 * Builds a `slides` scene backed by the real Google Slides embed HTML
 *
 * `speakerNotes` are supplied here rather than read from the sample: the
 * sample deck carries none, and confidence-monitor tests need something to
 * assert on.
 */
export function buildGoogleSlidesScene(): SeedScene {
  const html = readFileSync(SAMPLE_HTML_PATH, "utf8");
  const slideData = extractSlideData(html);
  if (!slideData) {
    throw new Error("extractSlideData returned null for sample.html");
  }

  const slides = slideData.slides;
  const slidesImport = {
    importId: IMPORT_ID,
    type: "googleslides" as const,
    name: "E2E Google Slides",
    fetchId: "fetch_e2egslides",
    presentationId: "e2e-sample",
    html,
    thumbnailLinks: slides.map(
      (_, i) => `https://example.com/e2e-slide-${i}.png`,
    ),
    slideClickCounts: slides.map((s) => s.clickCount),
    slideIds: slides.map((s) => s.slideId),
    speakerNotes: slides.map((_, i) => SAMPLE_SPEAKER_NOTES[i] ?? ""),
    slideTransitionDurations: slides.map((s) => s.slideTransitionDurationMs),
    slideClickDurations: slides.map((s) => s.clickDurationsMs),
    slideAutoplayDurations: slides.map((s) => s.autoplayObjectDurationMs),
  };

  return {
    pluginName: "slides",
    name: "Slides",
    activate: true,
    pluginData: {
      imports: { [IMPORT_ID]: slidesImport },
      slideOrder: slides.map((_, i) => `${IMPORT_ID}:${i}`),
    },
    rendererPluginData: {
      currentSlideIndex: 0,
      currentClickCount: 0,
      lastClickTimestamp: null,
    },
  };
}

const OFFICE_DIR = join(__dirname, "../sample-files/office");
/** Sprites are served by `routeOfficeSprites`, not the media store */
const OFFICE_HOST = "https://e2e-office.test";
const OFFICE_IMPORT_ID = "import_e2eoffice";

const readOfficeDeck = () =>
  JSON.parse(readFileSync(join(OFFICE_DIR, "deck.json"), "utf8")) as {
    w: number;
    h: number;
    slides: Record<string, any>[];
  };

const pngSize = (file: string) => {
  const png = readFileSync(file);
  return { w: png.readUInt32BE(16), h: png.readUInt32BE(20) };
};

/**
 * Builds a `slides` scene with a PowerPoint import as the importer would leave
 * it, from slideshow data captured off PowerPoint for the web. The slides are
 * the test deck's 1 (still), 2 (fade), 11 and 12 (morph), 14 (entrances) and
 * 17 (paragraph build).
 */
export function buildPowerPointScene(): SeedScene {
  const deck = readOfficeDeck();
  const slides = deck.slides.map(normalizeSlide);
  const imageIds = [
    ...new Set(deck.slides.flatMap((s) => s.resCat.map((r: any) => r.id))),
  ] as string[];
  const timings = slides.map((slide) =>
    navigationTiming(compileTimeline(slide)),
  );

  const pptImport = {
    importId: OFFICE_IMPORT_ID,
    type: "ppt" as const,
    name: "E2E PowerPoint",
    fetchId: "fetch_e2eoffice",
    thumbnailLinks: slides.map(() => `${OFFICE_HOST}/thumbnail.png`),
    slideIds: slides.map((s) => s.id),
    slideClickCounts: timings.map((t) => t.clickCount),
    slideClickDurations: timings.map((t) => t.clickDurationsMs),
    slideAutoplayDurations: timings.map((t) => t.autoplayMs),
    slideTransitionDurations: slides.map(
      (s) => transitionPlayback(s.transition).durationMs,
    ),
    office: {
      width: deck.w,
      height: deck.h,
      images: Object.fromEntries(
        imageIds.map((id) => [id, `${OFFICE_HOST}/sprites/${id}.png`]),
      ),
      imageSizes: Object.fromEntries(
        imageIds.map((id) => [
          id,
          pngSize(join(OFFICE_DIR, "sprites", `${id}.png`)),
        ]),
      ),
      slides,
    },
  };

  return {
    pluginName: "slides",
    name: "Slides",
    activate: true,
    pluginData: {
      imports: { [OFFICE_IMPORT_ID]: pptImport },
      slideOrder: slides.map((_, i) => `${OFFICE_IMPORT_ID}:${i}`),
    },
    rendererPluginData: {
      currentSlideIndex: 0,
      currentClickCount: 0,
      lastClickTimestamp: null,
    },
  };
}

/** Serves the seeded PowerPoint sprites to every page in the context */
export async function routeOfficeSprites(context: BrowserContext) {
  // Any image does for the thumbnails shown while sprites load
  const firstSprite = join(
    OFFICE_DIR,
    "sprites",
    `${readOfficeDeck().slides[0]!.resCat[0].id}.png`,
  );
  await context.route(`${OFFICE_HOST}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    const file =
      path === "/thumbnail.png"
        ? firstSprite
        : join(OFFICE_DIR, path.replace(/^\//, ""));
    return route.fulfill({
      path: file,
      contentType: "image/png",
      // The renderer fetches sprites into memory, which needs CORS
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
}
