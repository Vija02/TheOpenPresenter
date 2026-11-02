import {
  CONFIDENCE_LOOK_KEY,
  OVERLAY_LOOK_KEY,
  type PluginLook,
} from "@repo/base-types";
import {
  type LayoutDoc,
  createLayoutDoc,
  defaultConfidenceLook,
  lookBackdrop,
  selfHost,
} from "@repo/layout";

import {
  HIGHLIGHT_LIVE_PARAM,
  LOOK_PARAM,
  SHOW_BACKGROUND_PARAM,
  TEXT_COLOR_PARAM,
} from "./derivation";
import { FULL_SONG_LOOK, LOWER_THIRD_LOOK, MAIN_LOOK } from "./looks";
import { LIVE_COLOR } from "./template/layout";

const sections = { [SHOW_BACKGROUND_PARAM]: false, [LOOK_PARAM]: MAIN_LOOK };

/** The lyrics alone, filling the screen */
const fullScreen = (
  params: Record<string, unknown>,
  { backdrop }: { backdrop: boolean },
): LayoutDoc =>
  createLayoutDoc({
    fitMode: "letterbox",
    elements: [
      ...(backdrop ? [lookBackdrop()] : []),
      selfHost({
        id: "lyrics",
        name: "Lyrics",
        rect: { x: 0, y: 0, w: 100, h: 100 },
        params,
      }),
    ],
  });

export const screenLooks: PluginLook<LayoutDoc>[] = [
  {
    key: CONFIDENCE_LOOK_KEY,
    name: "Live + next",
    doc: defaultConfidenceLook({
      currentParams: sections,
      nextParams: { ...sections, [TEXT_COLOR_PARAM]: LIVE_COLOR },
    }),
  },
  {
    key: CONFIDENCE_LOOK_KEY,
    name: "Whole song",
    style: "whole-song",
    doc: fullScreen(
      {
        [SHOW_BACKGROUND_PARAM]: false,
        [LOOK_PARAM]: FULL_SONG_LOOK,
        [HIGHLIGHT_LIVE_PARAM]: true,
      },
      { backdrop: true },
    ),
  },
  {
    key: OVERLAY_LOOK_KEY,
    name: "Lower third",
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
  {
    key: OVERLAY_LOOK_KEY,
    name: "Full screen",
    style: "full-screen",
    doc: fullScreen(sections, { backdrop: false }),
  },
];
