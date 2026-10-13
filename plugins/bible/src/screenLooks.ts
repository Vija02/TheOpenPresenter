import { CONFIDENCE_LOOK_KEY, type PluginLook } from "@repo/base-types";
import { type LayoutDoc, defaultConfidenceLook } from "@repo/layout";

import { OFFSET_PARAM } from "./derivation";

export const screenLooks: PluginLook<LayoutDoc>[] = [
  {
    key: CONFIDENCE_LOOK_KEY,
    name: "Confidence monitor",
    doc: defaultConfidenceLook({ offsetParam: OFFSET_PARAM }),
  },
];
