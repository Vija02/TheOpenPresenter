import {
  createLayoutDoc,
  createShapeElement,
  createTextElement,
} from "../../packages/layout/src/schema/defaults";
import type { E2ECommandAPI } from "../e2eCommand";

/**
 * Seeds slides decks whose custom slides carry a video fill.
 *
 * Video playback state is driven by ACTIVATION (`activateSlide` writes
 * `_layoutVideoStates` and `lastClickTimestamp` together), so these helpers
 * deliberately seed the deck WITHOUT that state: the tests are about the
 * activation producing it. Seeding a ready-made `_layoutVideoStates` would make
 * every assertion pass against the fixture rather than against the code.
 */

/** Stable so seeded `slideOrder` refs and element lookups are deterministic. */
export const VIDEO_IMPORT_ID = "import_e2evideo";

/** The element id every seeded video fill uses, for `[data-lay-id]` lookups. */
export const VIDEO_ELEMENT_ID = "e2e-video";

/** A text element, so a slide is identifiable on screen without the video. */
export const LABEL_ELEMENT_ID = "e2e-label";

export type SeededVideo = {
  mediaName: string;
  thumbnailMediaName: string | null;
  duration: number;
};

/**
 * The `LayoutVideo` shape a picked video produces.
 *
 * Written out rather than imported from the plugin so a change to the schema
 * shows up here as a test failure to be looked at, not as a silent adaptation.
 */
const layoutVideo = (video: SeededVideo) => ({
  id: video.mediaName,
  url: `/media/data/${video.mediaName}`,
  hlsMediaName: null,
  thumbnailMediaName: video.thumbnailMediaName,
  title: "dummyVideo.mp4",
  duration: video.duration,
  thumbnailUrl: null,
});

type SlideOptions = {
  /** `once` is the audible, seekable mode; `loop` is a silent background. */
  playback: "loop" | "once";
  label: string;
};

/** One custom slide: a full-bleed video fill plus a caption to identify it.
 *
 * Built with the layout package's own factories rather than hand-written
 * literals: the element schemas carry a dozen fields each, and a seed that
 * guesses them produces a doc the renderer crashes on for reasons that have
 * nothing to do with the test.
 */
const videoSlideDoc = (video: SeededVideo, { playback, label }: SlideOptions) =>
  createLayoutDoc({
    fitMode: "fluid",
    elements: [
      createShapeElement({
        id: VIDEO_ELEMENT_ID,
        kind: "rect",
        rect: { x: 0, y: 0, w: 100, h: 100 },
        fill: {
          type: "video",
          video: layoutVideo(video),
          fit: "cover",
          opacity: 1,
          playback,
        },
      }),
      createTextElement({
        id: LABEL_ELEMENT_ID,
        content: label,
        rect: { x: 5, y: 40, w: 90, h: 20 },
      }),
    ],
  });

/**
 * A slides scene of custom (layout) slides, each holding one video fill.
 *
 * `rendererPluginData` carries only the position, with `lastClickTimestamp`
 * null and no `_layoutVideoStates`: nothing has been activated yet, so a
 * renderer opened against this seed must show a video that is NOT playing until
 * something activates a slide. That is what makes the playback assertions mean
 * something.
 */
export const buildVideoSlidesScene = (
  video: SeededVideo,
  slides: SlideOptions[],
) => ({
  pluginName: "slides",
  name: "Slides",
  activate: true,
  pluginData: {
    imports: {
      [VIDEO_IMPORT_ID]: {
        importId: VIDEO_IMPORT_ID,
        type: "custom" as const,
        name: "E2E Video Deck",
        fetchId: "fetch_e2evideo",
        docs: slides.map((slide) => videoSlideDoc(video, slide)),
        slideIds: slides.map((_, i) => `slide_e2evideo${i}`),
        // Required by BaseImportData. A custom deck renders live rather than
        // from an image, but the arrays are still indexed per slide and the
        // renderer reads them positionally.
        thumbnailLinks: slides.map(() => ""),
        slideClickCounts: slides.map(() => 0),
        _isFetching: false,
      },
    },
    slideOrder: slides.map((_, i) => `${VIDEO_IMPORT_ID}:${i}`),
  },
  rendererPluginData: {
    currentSlideIndex: null,
    currentClickCount: null,
    lastClickTimestamp: null,
  },
});

/** Seeds a transcoded video into an org's media library. */
export const seedVideo = async (
  e2eCommand: E2ECommandAPI,
  orgSlug: string,
  duration = 6.2,
): Promise<SeededVideo> => {
  const seeded = await e2eCommand.seedVideoMedia({
    orgSlug,
    videoPath: "./dummyFiles/dummyVideo.mp4",
    posterPath: "./dummyFiles/dummyImage.jpg",
    duration,
  });

  return {
    mediaName: seeded.mediaName,
    thumbnailMediaName: seeded.thumbnailMediaName,
    duration,
  };
};
