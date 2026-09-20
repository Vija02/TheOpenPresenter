import type { DataBinding } from "@repo/base-types";

import { docFeeds } from "../doc/edit";
import { LayoutDoc } from "../schema/document";
import { HostSource } from "../schema/element";
import { FrameData } from "./spans";

/** Fallback values */
export const sampleFeedData = (
  doc: LayoutDoc,
  bindingsFor: (source: HostSource) => DataBinding[],
): FrameData => {
  const out: FrameData = {};

  for (const feed of docFeeds(doc)) {
    for (const binding of bindingsFor(feed.source)) {
      out[`${feed.name}.${binding.key}`] = binding.label;
    }
  }

  return out;
};
