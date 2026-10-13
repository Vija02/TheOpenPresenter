import {
  CONFIDENCE_LOOK_KEY,
  OVERLAY_LOOK_KEY,
  type PluginLook,
} from "@repo/base-types";
import {
  type LayoutDoc,
  createLayoutDoc,
  defaultConfidenceLook,
  selfHost,
} from "@repo/layout";

import { LOOK_PARAM, SHOW_BACKGROUND_PARAM } from "./derivation";
import { LOWER_THIRD_LOOK, MAIN_LOOK } from "./looks";

const sections = { [SHOW_BACKGROUND_PARAM]: false, [LOOK_PARAM]: MAIN_LOOK };

export const screenLooks: PluginLook<LayoutDoc>[] = [
  {
    key: CONFIDENCE_LOOK_KEY,
    name: "Confidence monitor",
    doc: defaultConfidenceLook({
      currentParams: sections,
      nextParams: sections,
    }),
  },
  {
    key: OVERLAY_LOOK_KEY,
    name: "Overlay",
    doc: createLayoutDoc({
      elements: [
        selfHost({
          id: "lyrics",
          name: "Lyrics",
          rect: { x: 0, y: 0, w: 100, h: 100 },
          params: {
            [LOOK_PARAM]: LOWER_THIRD_LOOK,
            [SHOW_BACKGROUND_PARAM]: false,
          },
        }),
      ],
    }),
  },
];
