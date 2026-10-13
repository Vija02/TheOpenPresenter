import { CONFIDENCE_LOOK_KEY, type PluginLook } from "@repo/base-types";
import {
  type LayoutDoc,
  selfHost,
  createLayoutDoc,
  createTextElement,
  lookBackdrop,
} from "@repo/layout";

import {
  NOTES_BINDING,
  SLIDE_COUNT_BINDING,
  SLIDE_NUMBER_BINDING,
} from "./bindings";
import { OFFSET_PARAM } from "./derivation";

const FEED = "slides";

const presenterView = (): LayoutDoc => ({
  ...createLayoutDoc({
    fitMode: "letterbox",
    elements: [
      lookBackdrop(),
      selfHost({
        id: "live",
        name: "Live",
        rect: { x: 1.5, y: 3, w: 63, h: 63 },
        params: { [OFFSET_PARAM]: 0 },
      }),
      selfHost({
        id: "next",
        name: "Next",
        rect: { x: 66.5, y: 7, w: 32, h: 32 },
        params: { [OFFSET_PARAM]: 1 },
      }),
      createTextElement({
        id: "next-label",
        name: "Next label",
        rect: { x: 66.5, y: 2, w: 32, h: 4.5 },
        content: "Next",
        style: { fontSize: 1.6, color: "#9CA3AF", valign: "bottom" },
      }),
      createTextElement({
        id: "slide-number",
        name: "Slide number",
        rect: { x: 1.5, y: 68, w: 63, h: 6 },
        content: `Slide {{${FEED}.${SLIDE_NUMBER_BINDING}}} of {{${FEED}.${SLIDE_COUNT_BINDING}}}`,
        hideWhenEmpty: true,
        style: { fontSize: 1.8, color: "#D1D5DB", align: "left" },
      }),
      createTextElement({
        id: "notes",
        name: "Speaker notes",
        rect: { x: 66.5, y: 42, w: 32, h: 55 },
        content: `{{${FEED}.${NOTES_BINDING}}}`,
        fit: "shrinkToFit",
        hideWhenEmpty: true,
        style: {
          fontSize: 2,
          fontWeight: 400,
          color: "#FFFFFF",
          align: "left",
          valign: "top",
          lineHeight: 1.3,
        },
      }),
    ],
  }),
  feeds: [{ name: FEED, source: { kind: "self" }, derivation: null }],
});

export const screenLooks: PluginLook<LayoutDoc>[] = [
  {
    key: CONFIDENCE_LOOK_KEY,
    name: "Confidence monitor",
    doc: presenterView(),
  },
];
