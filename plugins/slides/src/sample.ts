import { SAMPLE_COLORS as C, type PluginSample } from "@repo/base-types";
import {
  type LayoutDoc,
  createLayoutDoc,
  createShapeElement,
  createTextElement,
  solidPaint,
} from "@repo/layout";

import type { PluginBaseData, PluginRendererData } from "./types";

const IMPORT_ID = "sample-deck";

const slide = (title: string, subtitle: string, background: string) =>
  createLayoutDoc({
    elements: [
      createShapeElement({
        id: "background",
        rect: { x: 0, y: 0, w: 100, h: 100 },
        fill: solidPaint(background),
        locked: true,
      }),
      createTextElement({
        id: "title",
        content: title,
        rect: { x: 8, y: 30, w: 84, h: 22 },
        style: { fontSize: 9, align: "center", valign: "center" },
      }),
      createTextElement({
        id: "subtitle",
        content: subtitle,
        rect: { x: 8, y: 54, w: 84, h: 12 },
        style: { fontSize: 4, align: "center", valign: "top" },
      }),
    ],
  });

const docs: LayoutDoc[] = [
  slide("Welcome", "We're glad you're here", C.background),
  slide("Announcements", "Youth night is this Friday", C.surface),
  slide("Thank you", "See you next week", C.accentDark),
];

const pluginData: PluginBaseData = {
  imports: {
    [IMPORT_ID]: {
      importId: IMPORT_ID,
      type: "custom",
      name: "Sample deck",
      fetchId: `fetch_${IMPORT_ID}`,
      thumbnailLinks: [],
      slideClickCounts: docs.map(() => 0),
      slideIds: docs.map((_, i) => `${IMPORT_ID}-slide-${i}`),
      speakerNotes: [
        "Welcome everyone and introduce yourself",
        "Mention the sign-up sheet at the back",
        "",
      ],
      docs,
      _isFetching: false,
    },
  },
  slideOrder: docs.map((_, i) => `${IMPORT_ID}:${i}`),
};

const rendererData: PluginRendererData = {
  currentSlideIndex: 0,
  currentClickCount: 0,
  lastClickTimestamp: null,
};

/** A short welcome deck with speaker notes, on its first slide */
export const sample: PluginSample = { pluginData, rendererData };
