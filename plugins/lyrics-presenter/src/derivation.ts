import type { DerivationField } from "@repo/base-types";

import { BUILT_IN_LOOKS } from "./looks";

export const OFFSET_PARAM = "offset";
export const SHOW_BACKGROUND_PARAM = "showBackground";
export const SHOW_CHORDS_PARAM = "showChords";
export const LOOK_PARAM = "look";
/** The look the song itself shows in */
export const SONG_LOOK = "";
export const HIGHLIGHT_LIVE_PARAM = "highlightLive";

export const derivationFields: DerivationField[] = [
  {
    key: OFFSET_PARAM,
    type: "number",
    label: "Slide offset",
    default: 0,
    min: -20,
    max: 20,
    step: 1,
    help: "0 is the live slide. 1 is the next one, -1 the previous.",
  },
  {
    key: SHOW_BACKGROUND_PARAM,
    type: "boolean",
    label: "Show background",
    default: true,
    help: "The live slide's background behind the lyrics.",
  },
  {
    key: SHOW_CHORDS_PARAM,
    type: "boolean",
    label: "Show chords",
    default: false,
    help: "Over the lyrics, for songs that have them.",
  },
  {
    key: LOOK_PARAM,
    type: "select",
    label: "Look",
    default: SONG_LOOK,
    options: [
      { value: SONG_LOOK, label: "The song's own" },
      ...BUILT_IN_LOOKS.map((look) => ({ value: look.key, label: look.name })),
    ],
    help: "Full song shows the whole song at once.",
  },
  {
    key: HIGHLIGHT_LIVE_PARAM,
    type: "boolean",
    label: "Highlight the live slide",
    default: false,
    help: "In a full song: the main output's lines, chords and heading.",
  },
];
