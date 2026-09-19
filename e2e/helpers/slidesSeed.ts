import { readFileSync } from "node:fs";
import { join } from "node:path";

import { extractSlideData } from "../../plugins/slides/src/importers/googleSlides/slideData/slideDataExtractor";

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
